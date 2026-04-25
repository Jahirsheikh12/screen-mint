#pragma once

#include <windows.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <d3d11.h>
#include <dxgi.h>
#include <wrl/client.h>
#include <string>
#include <vector>

using Microsoft::WRL::ComPtr;

class MFEncoder {
public:
    MFEncoder();
    ~MFEncoder();

    bool initialize(const std::wstring& outputPath, int width, int height, int fps, int bitrate,
                    ID3D11Device* device, ID3D11DeviceContext* context);
    bool writeFrame(ID3D11Texture2D* texture, int64_t timestampHns);
    bool finalize();

private:
    bool initializeGpuPipeline(ID3D11Texture2D* texture);
    void resetGpuPipeline();
    bool writeFrameGpu(ID3D11Texture2D* texture, int64_t timestampHns);
    bool writeFrameCpu(ID3D11Texture2D* texture, int64_t timestampHns);
    bool ensureCpuStagingTexture(int sourceWidth, int sourceHeight);

    ComPtr<IMFSinkWriter> sinkWriter_;
    ComPtr<IMFDXGIDeviceManager> dxgiDeviceManager_;
    ID3D11Device* device_ = nullptr;
    ID3D11DeviceContext* context_ = nullptr;
    ComPtr<ID3D11VideoDevice> videoDevice_;
    ComPtr<ID3D11VideoContext> videoContext_;
    ComPtr<ID3D11VideoProcessorEnumerator> videoProcessorEnumerator_;
    ComPtr<ID3D11VideoProcessor> videoProcessor_;
    std::vector<ComPtr<ID3D11Texture2D>> gpuTextures_;
    std::vector<ComPtr<ID3D11VideoProcessorOutputView>> gpuOutputViews_;
    ComPtr<ID3D11Texture2D> stagingTexture_;
    std::vector<uint8_t> nv12Buffer_;
    DWORD streamIndex_ = 0;
    UINT dxgiResetToken_ = 0;
    size_t gpuTextureIndex_ = 0;
    int gpuSourceWidth_ = 0;
    int gpuSourceHeight_ = 0;
    int stagingWidth_ = 0;
    int stagingHeight_ = 0;
    int width_ = 0;
    int height_ = 0;
    int fps_ = 60;
    bool gpuPipelineFailed_ = false;
    bool initialized_ = false;
};
