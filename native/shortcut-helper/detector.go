package main

import "time"

type doublePressDetector struct {
	lastPress time.Time
	window    time.Duration
}

func newDoublePressDetector(window time.Duration) *doublePressDetector {
	return &doublePressDetector{window: window}
}

func (d *doublePressDetector) reset() {
	d.lastPress = time.Time{}
}

func (d *doublePressDetector) setWindow(window time.Duration) {
	d.window = window
	d.reset()
}

func (d *doublePressDetector) press(now time.Time) bool {
	if !d.lastPress.IsZero() && now.Sub(d.lastPress) <= d.window {
		d.reset()
		return true
	}

	d.lastPress = now
	return false
}
