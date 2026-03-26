cmake_minimum_required(VERSION 3.10)
project(test_project VERSION 1.0.0)
add_executable(main src/main.c)
target_include_directories(main PRIVATE include)
