---
date: "January 28, 2025"
title: "Understanding C Programming on Windows"
subtitle: "Environments, Compilers and Standard Library Implementations"
---

For people like me, who's journey into C programming initially started in a Linux environment, the endeavor of writing C code on Windows can seem confusing at first. The development tools that we are familiar with aren't readily available, and there generally seems to be a separate way of going about things. The differences in C programming between Windows and Unix-like OSes mostly center around development environments, compilers (incl. ABI-compatibility[^interop] and commandline conventions) and standard library implementations. In this article, I want to lay out my understanding of the landscape for someone who is interested in programming in C on Windows. As we are going to see, there are two main paths to go down: the Windows way and the Unix way.

[^interop]: See [here](https://web.archive.org/web/20201130131120/http://mingw.org/wiki/Interoperability_of_Libraries_Created_by_Different_Compiler_Brands) for a short overview of the problem of ABI compatibility.

# The Windows Way

The first option is to fully embrace the Windows way of doing things. Microsoft provides the MSVC compiler, distributed through Visual Studio, as well as the MSVCRT and UCRT runtimes which include implementations of the C standard library. The latter are installed per default on all Windows systems; MSVCRT on pretty much all of them, and UCRT per default on Windows 10 and upwards (one can install it manually on Vista and upwards).

The MSVC C compiler is notoriously non-compliant for C99, due to missing variable length arrays (VLAs)[^c90]. It is, however, compliant with C11, because the support for VLAs has become optional with that version of the standard[^c11]. MSVC also uses different commandline conventions for its `cl.exe` compared to `gcc`, which means you cannot simply drop-in MSVC in a build script that expects GCC or Clang.

Clang/LLVM has first-party support for Windows. In general, Clang for Windows tries to be [compatible](https://clang.llvm.org/docs/MSVCCompatibility.html) with MSVC in terms of ABI-compatibility and language extensions. There is also [clang-cl](https://clang.llvm.org/docs/UsersManual.html#clang-cl), which is a _driver program_ for Clang that offers commandline compatibility with MSVC. Using that, Clang supports the same commandline arguments as the MSVC `cl.exe` and becomes compatible with Microsoft's linker and system headers, such that you can in fact use it as a drop-in replacement for MSVC in Visual Studio. This kind of compatibility tool is also available in a compiler-agnostic way through [cccl](https://github.com/swig/cccl), which can come in handy when using GCC through some of the approaches laid out below.

[^c90]: As such, the latest C standard fully supported by MSVC prior to C11 is C90 ([ANSI Conformance](https://learn.microsoft.com/en-us/cpp/c-language/ansi-conformance?view=msvc-170)).
[^c11]: For justifications why VLAs aren't supported in Microsoft's C11 implementation, see the corresponding [dev blog](https://devblogs.microsoft.com/cppblog/c11-and-c17-standard-support-arriving-in-msvc/).

# The Unix Way

The second main option is to re-create a Unix-like environment (like on Linux or macOS) on Windows. There are multiple different projects working on this from different angles. Even though I've used some of them myself in the past, the exact meaning and differences between these projects was never quite clear to me. I hope I can make things clearer here. Let's go through the four most prominent options.

## Windows Subsystem for Linux

[WSL](https://learn.microsoft.com/en-us/windows/wsl/about) runs a full Linux distribution (e.g. Ubuntu) in a virtualized environment on Windows. When invoking e.g. `gcc` on the WSL commandline, it uses the actual build of the compiler from the package repositories of the distribution, and all the Linux system calls are routed through the virtualized compatibility layer in order to be executed on Windows. Using a C compiler in WSL, installed as a regular Linux package, will produce ELF binaries for Linux. As such, within the context of C programming, this is mostly useful for cross-compiling programs on Windows _for Linux_.

## Cygwin

[Cygwin](https://www.cygwin.com/) provides a Unix-like environment including a CLI on Windows. You can compile code (but not directly run pre-compiled binaries!) for Unix-like systems on Windows using the Cygwin environment. It offers the `cygwin1.dll` library that attempts to implement a full POSIX compatibility layer on top of Windows API calls (for features like sockets, pthreads and semaphores), as well as a development toolchain including common GNU tools (incl. `gcc`, `binutils`, etc.).

Programs compiled for Windows using Cygwin use [Newlib](https://sourceware.org/newlib/) as a C standard library implementation and depend on the `cygwin1.dll`. The latter then has to be distributed alongside the application. Because the resulting binaries depend on the Cygwin environment, their ABI isn't compatible with either the MSVC ABI or the MinGW-w64 ABI (see below).

## MinGW-w64

_Not to be confused with the older, and at this point largely obsolete *MinGW (MinGW32)*, from which it was forked a long time ago._

[MinGW-w64](https://www.mingw-w64.org/) offers an environment for building native Windows programs using ported versions of common GNU/Linux development tools. It does not in and of itself come with a compiler and suitable build tools, but offloads this task to various different [pre-build toolchains](https://www.mingw-w64.org/downloads/). In terms of ABI compatibility, you can in principle link C code compiled within MinGW-w64 to C code compiled with MSVC, as long as they both use the same standard library implementation (either MSVCRT or UCRT)[^libc-abi]. In practice, libraries are more often built separately with MSVC and MinGW-w64 to remove any potential incompatibilities during the linking process. The official builds of MinGW-w64 target UCRT [per default](https://github.com/mingw-w64/mingw-w64/blob/master/mingw-w64-doc/howto-build/ucrt-vs-msvcrt.txt), but this behavior can be changed during the build process of the environment.

Microsoft provides header files and static import libraries for the Windows API through the [Windows SDK](https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/). It contains some proprietary components and requires agreeing to Microsoft's terms and conditions during installation, making it difficult to redistribute it outside of Visual Studio. To work around this, MinGW-w64 offers freely distributable alternatives for header files and import libraries. As such, you can use its environment without ever having to touch Microsoft's development tools (incl. Visual Studio and its installers) at all. 

[^libc-abi]: The [potential incompatibilities](https://learn.microsoft.com/en-us/cpp/c-runtime-library/crt-library-features?view=msvc-170#what-problems-exist-if-an-application-uses-more-than-one-crt-version) when linking binaries using different CRTs largely arise from differences in struct layouts and memory being passed across DLL boundaries. You can architect your program in a way that evades this issue, by allocating and freeing the same memory regions within one DLL, and by making sure that function calls across boundaries pass arguments by value. It seems to me that all of this isn't nearly as much of a problem when not using C++-style object oriented programming, where memory is allocated ad-hoc all across the program all the time.

## MSYS2

_Not to be confused with *MSYS* for the old MinGW (MinGW32)._

[MSYS2](https://www.msys2.org/) also attempts to offer a Unix-like environment for Windows. However, instead of running a whole Linux distribution through a virtual machine (like WSL) or implementing a full POSIX compatibility layer (like Cygwin), it focuses on providing a pragmatic environment containing just the necessary tools for development and deployment. In doing so, it builds upon both Cygwin and MinGW-w64. It ships a simplified version of Cygwin's `cygwin1.dll` library in order to provide a package manager (Pacman), a shell (Bash) and various Unix tools.

For compilation, MSYS2 has different environments set up for building native Windows programs. These include MINGW64 (the MinGW-w64 development environment), UCRT64 (like MINGW64 but linking against UCRT instead of MSVCRT) and CLANG64 (like UCRT64 but using Clang/LLVM instead of GCC). The ABI compatibility then depends on which compiler toolchain and standard library implementation one chooses to use.

\

As we can see, there are two main paths one can go down: using Visual Studio with MSVC and its whole development toolchain, or establishing a Unix-like environment on Windows and use GCC-compatible compilers. Which to choose ultimately depends on your taste and your requirements. For _Seaside_, the IDE that I am working on, I am choosing the Unix way. Given that it is meant to be a cross-platform application, this will give me a similar development environment on Windows, macOS and Linux. I can _dogfood_ the environment during the development of the IDE itself, and later attempt to ship exactly that environment for use within the IDE.
