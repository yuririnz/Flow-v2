//go:build windows

package main

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

const (
	defaultKeyCode       = 0x12
	defaultDoublePressMS = 500
	processQueryLimited  = 0x1000
)

var (
	user32                     = syscall.NewLazyDLL("user32.dll")
	kernel32                   = syscall.NewLazyDLL("kernel32.dll")
	getAsyncKeyState           = user32.NewProc("GetAsyncKeyState")
	getForegroundWindow        = user32.NewProc("GetForegroundWindow")
	getWindowThreadProcessID   = user32.NewProc("GetWindowThreadProcessId")
	openProcess                = kernel32.NewProc("OpenProcess")
	queryFullProcessImageNameW = kernel32.NewProc("QueryFullProcessImageNameW")
	closeHandle                = kernel32.NewProc("CloseHandle")
)

type shortcutConfig struct {
	keyCode int
	window  time.Duration
}

type command struct {
	config *shortcutConfig
	quit   bool
}

func main() {
	commands := make(chan command)
	go readCommands(os.Stdin, commands)

	writer := bufio.NewWriter(os.Stdout)
	writeLine(writer, "READY")

	config := shortcutConfig{
		keyCode: defaultKeyCode,
		window:  defaultDoublePressMS * time.Millisecond,
	}
	detector := newDoublePressDetector(config.window)
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()

	wasDown := false
	for {
		select {
		case incoming, ok := <-commands:
			if !ok || incoming.quit {
				return
			}

			if incoming.config != nil {
				config = *incoming.config
				detector.setWindow(config.window)
				wasDown = keyIsDown(config.keyCode)
			}

		case now := <-ticker.C:
			isDown := keyIsDown(config.keyCode)
			if isDown && !wasDown {
				if afterEffectsIsForeground() {
					if detector.press(now) {
						writeLine(writer, "APPLY")
					}
				} else {
					detector.reset()
				}
			}
			wasDown = isDown
		}
	}
}

func readCommands(reader io.Reader, commands chan<- command) {
	defer close(commands)
	scanner := bufio.NewScanner(reader)

	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) == 0 {
			continue
		}

		switch strings.ToUpper(fields[0]) {
		case "QUIT":
			commands <- command{quit: true}
			return
		case "CONFIG":
			if len(fields) != 3 {
				continue
			}

			keyCode, keyErr := strconv.Atoi(fields[1])
			windowMS, windowErr := strconv.Atoi(fields[2])
			if keyErr != nil || windowErr != nil || keyCode < 1 || keyCode > 255 || windowMS < 150 || windowMS > 2000 {
				continue
			}

			commands <- command{config: &shortcutConfig{
				keyCode: keyCode,
				window:  time.Duration(windowMS) * time.Millisecond,
			}}
		}
	}
}

func writeLine(writer *bufio.Writer, value string) {
	_, _ = fmt.Fprintln(writer, value)
	_ = writer.Flush()
}

func keyIsDown(keyCode int) bool {
	result, _, _ := getAsyncKeyState.Call(uintptr(keyCode))
	return result&0x8000 != 0
}

func afterEffectsIsForeground() bool {
	window, _, _ := getForegroundWindow.Call()
	if window == 0 {
		return false
	}

	var processID uint32
	_, _, _ = getWindowThreadProcessID.Call(window, uintptr(unsafe.Pointer(&processID)))
	if processID == 0 {
		return false
	}

	process, _, _ := openProcess.Call(processQueryLimited, 0, uintptr(processID))
	if process == 0 {
		return false
	}
	defer closeHandle.Call(process)

	buffer := make([]uint16, 1024)
	size := uint32(len(buffer))
	result, _, _ := queryFullProcessImageNameW.Call(
		process,
		0,
		uintptr(unsafe.Pointer(&buffer[0])),
		uintptr(unsafe.Pointer(&size)),
	)
	if result == 0 || size == 0 {
		return false
	}

	processPath := syscall.UTF16ToString(buffer[:size])
	return strings.EqualFold(filepath.Base(processPath), "AfterFX.exe")
}
