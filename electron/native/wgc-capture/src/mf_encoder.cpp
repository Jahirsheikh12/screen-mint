#include "mf_encoder.h"

#include <algorithm>
#include <codecapi.h>
#include <cstring>
#include <iostream>
#include <mfapi.h>
#include <mferror.h>

#pragma comment(lib, "mfplat.lib")
#pragma comment(lib, "mfreadwrite.lib")
#pragma comment(lib, "mf.lib")
#pragma comment(lib, "mfuuid.lib")

static int clampByte(int v) {
    return v < 0 ? 0 : (v > 255 ? 255 : v);
}

static int ensureEven(int value) {
    return value % 2 == 0 ? value : value - 1;
}

MFEncoder::MFEncoder() {}

MFEncoder::~MFEncoder() {
    finalize();
}

bool MFEncoder::initialize(const std::wstring& outputPath, int width, int height, int fps, int bitrate,
                           ID3D11Device* device, ID3D11DeviceContext* context) {
    if (initialized_) return false;

    if (width % 2 != 0 || height % 2 != 0) {
        std::cerr << "ERROR: Encoder dimensions must be even, got " << width << "x" << height << std::endl;
        return false;
    }

    width_ = width;
    height_ = height;
    fps_ = fps;
    device_ = device;
    context_ = context;

    HRESULT hr = MFStartup(MF_VERSION);
    if (FAILED(hr)) {
        std::cerr << "ERROR: MFStartup failed: 0x" << std::hex << hr << std::endl;
        return false;
    }

    hr = MFCreateDXGIDeviceManager(&dxgiResetToken_, &dxgiDeviceManager_);
    if (SUCCEEDED(hr)) {
        hr = dxgiDeviceManager_->ResetDevice(device_, dxgiResetToken_);
    }
    if (FAILED(hr)) {
        std::cerr << "WARNING: DXGI device manager unavailable, WGC encoder will use CPU fallback: 0x"
                  << std::hex << hr << std::endl;
        dxgiDeviceManager_.Reset();
    }

    ComPtr<IMFMediaType> outputType;
    hr = MFCreateMediaType(&outputType);
    if (FAILED(hr)) return false;

    outputType->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
    outputType->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_H264);
    outputType->SetUINT32(MF_MT_AVG_BITRATE, bitrate > 0 ? bitrate : 20000000);
    MFSetAttributeSize(outputType.Get(), MF_MT_FRAME_SIZE, width_, height_);
    MFSetAttributeRatio(outputType.Get(), MF_MT_FRAME_RATE, fps_, 1);
    MFSetAttributeRatio(outputType.Get(), MF_MT_PIXEL_ASPECT_RATIO, 1, 1);
    outputType->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);

    ComPtr<IMFMediaType> inputType;
    hr = MFCreateMediaType(&inputType);
    if (FAILED(hr)) return false;

    inputType->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
    inputType->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_NV12);
    MFSetAttributeSize(inputType.Get(), MF_MT_FRAME_SIZE, width_, height_);
    MFSetAttributeRatio(inputType.Get(), MF_MT_FRAME_RATE, fps_, 1);
    MFSetAttributeRatio(inputType.Get(), MF_MT_PIXEL_ASPECT_RATIO, 1, 1);
    inputType->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);

    ComPtr<IMFAttributes> writerAttrs;
    hr = MFCreateAttributes(&writerAttrs, 3);
    if (FAILED(hr)) return false;

    writerAttrs->SetUINT32(MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, TRUE);
    writerAttrs->SetUINT32(MF_SINK_WRITER_DISABLE_THROTTLING, TRUE);
    if (dxgiDeviceManager_) {
        writerAttrs->SetUnknown(MF_SINK_WRITER_D3D_MANAGER, dxgiDeviceManager_.Get());
    }

    hr = MFCreateSinkWriterFromURL(outputPath.c_str(), nullptr, writerAttrs.Get(), &sinkWriter_);
    if (FAILED(hr)) {
        std::cerr << "ERROR: MFCreateSinkWriterFromURL failed: 0x" << std::hex << hr << std::endl;
        return false;
    }

    hr = sinkWriter_->AddStream(outputType.Get(), &streamIndex_);
    if (FAILED(hr)) {
        std::cerr << "ERROR: AddStream failed: 0x" << std::hex << hr << std::endl;
        return false;
    }

    hr = sinkWriter_->SetInputMediaType(streamIndex_, inputType.Get(), nullptr);
    if (FAILED(hr)) {
        std::cerr << "ERROR: SetInputMediaType failed: 0x" << std::hex << hr << std::endl;
        return false;
    }

    hr = sinkWriter_->BeginWriting();
    if (FAILED(hr)) {
        std::cerr << "ERROR: BeginWriting failed: 0x" << std::hex << hr << std::endl;
        return false;
    }

    const int ySize = width_ * height_;
    const int uvSize = (width_ / 2) * (height_ / 2) * 2;
    nv12Buffer_.resize(ySize + uvSize);

    initialized_ = true;
    return true;
}

bool MFEncoder::initializeGpuPipeline(ID3D11Texture2D* texture) {
    if (!dxgiDeviceManager_ || !device_ || !context_ || !texture) return false;

    D3D11_TEXTURE2D_DESC sourceDesc = {};
    texture->GetDesc(&sourceDesc);
    const int sourceWidth = ensureEven(static_cast<int>(sourceDesc.Width));
    const int sourceHeight = ensureEven(static_cast<int>(sourceDesc.Height));
    if (sourceWidth <= 0 || sourceHeight <= 0) return false;

    if (videoProcessor_ && gpuSourceWidth_ == sourceWidth && gpuSourceHeight_ == sourceHeight) {
        return true;
    }

    resetGpuPipeline();

    HRESULT hr = device_->QueryInterface(IID_PPV_ARGS(&videoDevice_));
    if (FAILED(hr)) return false;

    hr = context_->QueryInterface(IID_PPV_ARGS(&videoContext_));
    if (FAILED(hr)) return false;

    D3D11_VIDEO_PROCESSOR_CONTENT_DESC contentDesc = {};
    contentDesc.InputFrameFormat = D3D11_VIDEO_FRAME_FORMAT_PROGRESSIVE;
    contentDesc.InputWidth = sourceWidth;
    contentDesc.InputHeight = sourceHeight;
    contentDesc.OutputWidth = width_;
    contentDesc.OutputHeight = height_;
    contentDesc.Usage = D3D11_VIDEO_USAGE_PLAYBACK_NORMAL;

    hr = videoDevice_->CreateVideoProcessorEnumerator(&contentDesc, &videoProcessorEnumerator_);
    if (FAILED(hr)) return false;

    hr = videoDevice_->CreateVideoProcessor(videoProcessorEnumerator_.Get(), 0, &videoProcessor_);
    if (FAILED(hr)) return false;

    const D3D11_RECT sourceRect = {0, 0, sourceWidth, sourceHeight};
    const D3D11_RECT destRect = {0, 0, width_, height_};
    videoContext_->VideoProcessorSetStreamSourceRect(videoProcessor_.Get(), 0, TRUE, &sourceRect);
    videoContext_->VideoProcessorSetStreamDestRect(videoProcessor_.Get(), 0, TRUE, &destRect);
    videoContext_->VideoProcessorSetOutputTargetRect(videoProcessor_.Get(), TRUE, &destRect);

    D3D11_TEXTURE2D_DESC outputDesc = {};
    outputDesc.Width = width_;
    outputDesc.Height = height_;
    outputDesc.MipLevels = 1;
    outputDesc.ArraySize = 1;
    outputDesc.Format = DXGI_FORMAT_NV12;
    outputDesc.SampleDesc.Count = 1;
    outputDesc.Usage = D3D11_USAGE_DEFAULT;
    outputDesc.BindFlags = D3D11_BIND_RENDER_TARGET;

    D3D11_VIDEO_PROCESSOR_OUTPUT_VIEW_DESC outputViewDesc = {};
    outputViewDesc.ViewDimension = D3D11_VPOV_DIMENSION_TEXTURE2D;
    outputViewDesc.Texture2D.MipSlice = 0;

    constexpr size_t textureCount = 4;
    gpuTextures_.resize(textureCount);
    gpuOutputViews_.resize(textureCount);

    for (size_t i = 0; i < textureCount; i++) {
        hr = device_->CreateTexture2D(&outputDesc, nullptr, &gpuTextures_[i]);
        if (FAILED(hr)) return false;

        hr = videoDevice_->CreateVideoProcessorOutputView(
            gpuTextures_[i].Get(),
            videoProcessorEnumerator_.Get(),
            &outputViewDesc,
            &gpuOutputViews_[i]);
        if (FAILED(hr)) return false;
    }

    gpuSourceWidth_ = sourceWidth;
    gpuSourceHeight_ = sourceHeight;
    gpuTextureIndex_ = 0;
    return true;
}

void MFEncoder::resetGpuPipeline() {
    gpuOutputViews_.clear();
    gpuTextures_.clear();
    videoProcessor_.Reset();
    videoProcessorEnumerator_.Reset();
    videoContext_.Reset();
    videoDevice_.Reset();
    gpuTextureIndex_ = 0;
    gpuSourceWidth_ = 0;
    gpuSourceHeight_ = 0;
}

bool MFEncoder::writeFrameGpu(ID3D11Texture2D* texture, int64_t timestampHns) {
    if (gpuPipelineFailed_) return false;

    if (!initializeGpuPipeline(texture)) {
        gpuPipelineFailed_ = true;
        std::cerr << "WARNING: GPU WGC conversion unavailable, falling back to CPU conversion." << std::endl;
        return false;
    }

    D3D11_VIDEO_PROCESSOR_INPUT_VIEW_DESC inputViewDesc = {};
    inputViewDesc.FourCC = 0;
    inputViewDesc.ViewDimension = D3D11_VPIV_DIMENSION_TEXTURE2D;
    inputViewDesc.Texture2D.MipSlice = 0;
    inputViewDesc.Texture2D.ArraySlice = 0;

    ComPtr<ID3D11VideoProcessorInputView> inputView;
    HRESULT hr = videoDevice_->CreateVideoProcessorInputView(
        texture,
        videoProcessorEnumerator_.Get(),
        &inputViewDesc,
        &inputView);
    if (FAILED(hr)) return false;

    const size_t textureIndex = gpuTextureIndex_;
    gpuTextureIndex_ = (gpuTextureIndex_ + 1) % gpuTextures_.size();

    D3D11_VIDEO_PROCESSOR_STREAM stream = {};
    stream.Enable = TRUE;
    stream.pInputSurface = inputView.Get();

    hr = videoContext_->VideoProcessorBlt(
        videoProcessor_.Get(),
        gpuOutputViews_[textureIndex].Get(),
        0,
        1,
        &stream);
    if (FAILED(hr)) return false;

    ComPtr<IMFMediaBuffer> mediaBuffer;
    hr = MFCreateDXGISurfaceBuffer(
        __uuidof(ID3D11Texture2D),
        gpuTextures_[textureIndex].Get(),
        0,
        FALSE,
        &mediaBuffer);
    if (FAILED(hr)) return false;

    mediaBuffer->SetCurrentLength(static_cast<DWORD>(width_ * height_ * 3 / 2));

    ComPtr<IMFSample> sample;
    hr = MFCreateSample(&sample);
    if (FAILED(hr)) return false;

    sample->AddBuffer(mediaBuffer.Get());
    sample->SetSampleTime(timestampHns);
    sample->SetSampleDuration(10000000LL / fps_);

    hr = sinkWriter_->WriteSample(streamIndex_, sample.Get());
    return SUCCEEDED(hr);
}

bool MFEncoder::ensureCpuStagingTexture(int sourceWidth, int sourceHeight) {
    if (stagingTexture_ && stagingWidth_ == sourceWidth && stagingHeight_ == sourceHeight) {
        return true;
    }

    stagingTexture_.Reset();
    stagingWidth_ = sourceWidth;
    stagingHeight_ = sourceHeight;

    D3D11_TEXTURE2D_DESC stagingDesc = {};
    stagingDesc.Width = sourceWidth;
    stagingDesc.Height = sourceHeight;
    stagingDesc.MipLevels = 1;
    stagingDesc.ArraySize = 1;
    stagingDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    stagingDesc.SampleDesc.Count = 1;
    stagingDesc.Usage = D3D11_USAGE_STAGING;
    stagingDesc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;

    HRESULT hr = device_->CreateTexture2D(&stagingDesc, nullptr, &stagingTexture_);
    if (FAILED(hr)) {
        stagingTexture_.Reset();
        stagingWidth_ = 0;
        stagingHeight_ = 0;
        std::cerr << "ERROR: Failed to create staging texture: 0x" << std::hex << hr << std::endl;
        return false;
    }

    return true;
}

bool MFEncoder::writeFrameCpu(ID3D11Texture2D* texture, int64_t timestampHns) {
    D3D11_TEXTURE2D_DESC sourceDesc = {};
    texture->GetDesc(&sourceDesc);
    const int sourceWidth = ensureEven(static_cast<int>(sourceDesc.Width));
    const int sourceHeight = ensureEven(static_cast<int>(sourceDesc.Height));

    if (!ensureCpuStagingTexture(sourceWidth, sourceHeight)) return false;

    context_->CopyResource(stagingTexture_.Get(), texture);

    D3D11_MAPPED_SUBRESOURCE mapped;
    HRESULT hr = context_->Map(stagingTexture_.Get(), 0, D3D11_MAP_READ, 0, &mapped);
    if (FAILED(hr)) return false;

    const uint8_t* bgra = static_cast<const uint8_t*>(mapped.pData);
    const int bgraPitch = static_cast<int>(mapped.RowPitch);

    for (int y = 0; y < height_; y++) {
        const int sourceY = std::min(sourceHeight - 1, (y * sourceHeight) / height_);
        for (int x = 0; x < width_; x++) {
            const int sourceX = std::min(sourceWidth - 1, (x * sourceWidth) / width_);
            const uint8_t* pixel = bgra + sourceY * bgraPitch + sourceX * 4;
            const uint8_t b = pixel[0], g = pixel[1], r = pixel[2];
            const int yVal = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
            nv12Buffer_[y * width_ + x] = static_cast<uint8_t>(clampByte(yVal));
        }
    }

    const int ySize = width_ * height_;
    uint8_t* uvPlane = nv12Buffer_.data() + ySize;
    for (int y = 0; y < height_; y += 2) {
        const int sourceY = std::min(sourceHeight - 1, (y * sourceHeight) / height_);
        for (int x = 0; x < width_; x += 2) {
            const int sourceX = std::min(sourceWidth - 1, (x * sourceWidth) / width_);
            const uint8_t* pixel = bgra + sourceY * bgraPitch + sourceX * 4;
            const uint8_t b = pixel[0], g = pixel[1], r = pixel[2];
            const int u = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
            const int v = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
            const int uvIdx = (y / 2) * width_ + (x / 2) * 2;
            uvPlane[uvIdx] = static_cast<uint8_t>(clampByte(u));
            uvPlane[uvIdx + 1] = static_cast<uint8_t>(clampByte(v));
        }
    }

    context_->Unmap(stagingTexture_.Get(), 0);

    ComPtr<IMFMediaBuffer> buffer;
    hr = MFCreateMemoryBuffer(static_cast<DWORD>(nv12Buffer_.size()), &buffer);
    if (FAILED(hr)) return false;

    BYTE* bufferData = nullptr;
    hr = buffer->Lock(&bufferData, nullptr, nullptr);
    if (FAILED(hr)) return false;

    std::memcpy(bufferData, nv12Buffer_.data(), nv12Buffer_.size());
    buffer->Unlock();
    buffer->SetCurrentLength(static_cast<DWORD>(nv12Buffer_.size()));

    ComPtr<IMFSample> sample;
    hr = MFCreateSample(&sample);
    if (FAILED(hr)) return false;

    sample->AddBuffer(buffer.Get());
    sample->SetSampleTime(timestampHns);
    sample->SetSampleDuration(10000000LL / fps_);

    hr = sinkWriter_->WriteSample(streamIndex_, sample.Get());
    return SUCCEEDED(hr);
}

bool MFEncoder::writeFrame(ID3D11Texture2D* texture, int64_t timestampHns) {
    if (!initialized_ || !sinkWriter_ || !texture) return false;
    return writeFrameGpu(texture, timestampHns) || writeFrameCpu(texture, timestampHns);
}

bool MFEncoder::finalize() {
    if (!initialized_) return false;
    initialized_ = false;

    resetGpuPipeline();
    stagingTexture_.Reset();
    stagingWidth_ = 0;
    stagingHeight_ = 0;
    nv12Buffer_.clear();
    nv12Buffer_.shrink_to_fit();
    dxgiDeviceManager_.Reset();

    if (!sinkWriter_) {
        MFShutdown();
        return false;
    }

    HRESULT hr = sinkWriter_->Finalize();
    sinkWriter_.Reset();
    MFShutdown();
    return SUCCEEDED(hr);
}
