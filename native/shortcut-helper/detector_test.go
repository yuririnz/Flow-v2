//go:build windows

package main

import (
	"strings"
	"testing"
	"time"
)

func TestDoublePressDetector(t *testing.T) {
	start := time.Unix(100, 0)
	detector := newDoublePressDetector(500 * time.Millisecond)

	if detector.press(start) {
		t.Fatal("first press must not trigger")
	}

	if !detector.press(start.Add(300 * time.Millisecond)) {
		t.Fatal("second press inside the window must trigger")
	}

	if detector.press(start.Add(600 * time.Millisecond)) {
		t.Fatal("a press after a trigger must start a new pair")
	}
}

func TestDoublePressDetectorExpiresAndResets(t *testing.T) {
	start := time.Unix(200, 0)
	detector := newDoublePressDetector(500 * time.Millisecond)

	detector.press(start)
	if detector.press(start.Add(700 * time.Millisecond)) {
		t.Fatal("presses outside the window must not trigger")
	}

	detector.reset()
	if detector.press(start.Add(800 * time.Millisecond)) {
		t.Fatal("a reset must clear the pending first press")
	}
}

func TestReadCommands(t *testing.T) {
	commands := make(chan command)
	go readCommands(strings.NewReader("CONFIG 65 450\nQUIT\n"), commands)

	configuration := <-commands
	if configuration.config == nil || configuration.config.keyCode != 65 || configuration.config.window != 450*time.Millisecond {
		t.Fatalf("unexpected configuration: %#v", configuration.config)
	}

	quit := <-commands
	if !quit.quit {
		t.Fatal("QUIT must stop the helper")
	}
}
