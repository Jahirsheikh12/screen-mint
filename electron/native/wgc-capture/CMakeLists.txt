cmake_minimum_required(VERSION 3.20)
project(wgc-capture LANGUAGES CXX)

# C++/WinRT needs C++20 coroutines: MSVC 14.5x (VS 2026) removed the old <experimental/coroutine>.
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(wgc-capture
  src/main.cpp
  src/wgc_session.cpp
  src/mf_encoder.cpp
  src/monitor_utils.cpp
  src/wasapi_loopback.cpp
)

target_compile_options(wgc-capture PRIVATE /EHsc /W3 /utf-8)
target_compile_definitions(wgc-capture PRIVATE NOMINMAX WIN32_LEAN_AND_MEAN)

target_link_libraries(wgc-capture PRIVATE
  windowsapp
  d3d11
  dxgi
  mfplat
  mfreadwrite
  mf
  mfuuid
  ole32
  shcore
)
