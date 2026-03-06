/* ═══════════════════════════════════════════════
   Play Axis Controller
   Animate through time/ordinal dimension values
   ═══════════════════════════════════════════════ */

"use strict";

import { RenderConfig, ScatterDataPoint } from "../types";
import { el, clearChildren } from "../utils/dom";

export interface PlayAxisState {
    isPlaying: boolean;
    currentIndex: number;
    timer: ReturnType<typeof setInterval> | null;
}

export interface PlayAxisCallbacks {
    onFrameChange: (frameIndex: number) => void;
}

/**
 * Build play controls UI (play/pause button + slider + label).
 * Returns the state object for controlling playback.
 */
export function buildPlayControls(
    container: HTMLElement,
    playValues: string[],
    cfg: RenderConfig["play"],
    callbacks: PlayAxisCallbacks,
): PlayAxisState {
    clearChildren(container);

    const state: PlayAxisState = {
        isPlaying: false,
        currentIndex: 0,
        timer: null,
    };

    if (!cfg.showPlayControls || playValues.length === 0) {
        container.style.display = "none";
        return state;
    }

    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.gap = "8px";
    container.style.padding = "6px 12px";

    /* ── Play/Pause button ── */
    const playBtn = el("button", "bscatter-play-btn", "Play");
    playBtn.title = "Play";
    container.appendChild(playBtn);

    /* ── Slider ── */
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "bscatter-play-slider";
    slider.min = "0";
    slider.max = String(playValues.length - 1);
    slider.value = "0";
    slider.style.flex = "1";
    container.appendChild(slider);

    /* ── Frame label ── */
    const frameLabel = el("span", "bscatter-play-label", playValues[0] ?? "");
    frameLabel.style.minWidth = "80px";
    frameLabel.style.textAlign = "center";
    container.appendChild(frameLabel);

    /* ── Event handlers ── */

    function updateFrame(idx: number): void {
        state.currentIndex = idx;
        slider.value = String(idx);
        frameLabel.textContent = playValues[idx] ?? "";
        callbacks.onFrameChange(idx);
    }

    function pause(): void {
        state.isPlaying = false;
        playBtn.textContent = "Play";
        playBtn.title = "Play";
        if (state.timer !== null) {
            clearInterval(state.timer);
            state.timer = null;
        }
    }

    function play(): void {
        state.isPlaying = true;
        playBtn.textContent = "Pause";
        playBtn.title = "Pause";
        state.timer = setInterval(() => {
            const next = (state.currentIndex + 1) % playValues.length;
            updateFrame(next);
            // Stop at the last frame instead of looping
            if (next === playValues.length - 1) {
                pause();
            }
        }, cfg.playSpeed);
    }

    playBtn.addEventListener("click", () => {
        if (state.isPlaying) {
            pause();
        } else {
            // Restart from beginning if already at the last frame
            if (state.currentIndex >= playValues.length - 1) {
                updateFrame(0);
            }
            play();
        }
    });

    slider.addEventListener("input", () => {
        const idx = parseInt(slider.value, 10);
        if (state.isPlaying) pause();
        updateFrame(idx);
    });

    // Initial frame
    updateFrame(0);

    return state;
}

/**
 * Filter data points for the given play-axis frame.
 */
export function filterPointsByFrame(
    allPoints: ScatterDataPoint[],
    playValues: string[],
    frameIndex: number,
): ScatterDataPoint[] {
    if (playValues.length === 0) return allPoints;
    const frameValue = playValues[frameIndex];
    if (frameValue == null) return allPoints;
    return allPoints.filter((p) => p.playAxisValue === frameValue);
}

/**
 * Get all points from previous frames (for trail rendering).
 */
export function getTrailPoints(
    allPoints: ScatterDataPoint[],
    playValues: string[],
    currentFrameIndex: number,
): ScatterDataPoint[] {
    if (playValues.length === 0 || currentFrameIndex <= 0) return [];
    const previousValues = new Set(playValues.slice(0, currentFrameIndex));
    return allPoints.filter((p) => p.playAxisValue != null && previousValues.has(p.playAxisValue));
}

/**
 * Clean up play timer when visual is destroyed or data changes.
 */
export function destroyPlayControls(state: PlayAxisState): void {
    if (state.timer !== null) {
        clearInterval(state.timer);
        state.timer = null;
    }
    state.isPlaying = false;
}
