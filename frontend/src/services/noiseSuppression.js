// src/services/noiseSuppression.js
// Noise suppression service
// ✅ TEMPORARY FIX: Bypass RNNoise (broken due to fetch() unavailable in AudioWorklet)
// Uses browser native noise suppression instead until RNNoise WASM loading is properly fixed

class NoiseSuppressor {
  constructor() {
    this.initialized = false;
    this.processing = false;
    this.bypassMode = true; // ✅ Always bypass for now
  }

  async initialize() {
    if (this.initialized) {
      console.log("🔇 NoiseSuppressor already initialized (bypass mode)");
      return true;
    }

    console.log("🔇 NoiseSuppressor initialized in BYPASS MODE");
    console.log("   → Using browser native noise suppression instead of RNNoise");
    console.log("   → This is a temporary fix until RNNoise WASM loading is properly implemented");
    
    this.initialized = true;
    return true;
  }

  async processTrack(inputTrack) {
    if (!inputTrack) {
      console.error("❌ No input track provided");
      return null;
    }

    // ✅ BYPASS MODE: Return original track unchanged
    // The getUserMedia constraints should already have noiseSuppression: true
    // which enables browser-native noise suppression
    console.log("🔇 NoiseSuppressor BYPASS: Returning original track", {
      trackId: inputTrack.id,
      label: inputTrack.label,
      enabled: inputTrack.enabled,
      muted: inputTrack.muted,
      readyState: inputTrack.readyState,
    });
    
    // Verify track is in good state
    if (inputTrack.readyState !== 'live') {
      console.warn("⚠️ Input track is not live:", inputTrack.readyState);
    }
    
    if (!inputTrack.enabled) {
      console.warn("⚠️ Input track is disabled, enabling...");
      inputTrack.enabled = true;
    }

    this.processing = true;
    return inputTrack;
  }

  async destroy() {
    console.log("🔇 NoiseSuppressor destroy (bypass mode - nothing to clean up)");
    this.initialized = false;
    this.processing = false;
  }

  isProcessing() {
    return this.processing;
  }

  isInitialized() {
    return this.initialized;
  }
}

// Singleton instance
let noiseSuppressorInstance = null;

/**
 * Get the singleton NoiseSuppressor instance
 * @returns {NoiseSuppressor}
 */
export function getNoiseSuppressor() {
  if (!noiseSuppressorInstance) {
    noiseSuppressorInstance = new NoiseSuppressor();
  }
  return noiseSuppressorInstance;
}

/**
 * Reset the singleton instance (useful for cleanup)
 */
export function resetNoiseSuppressor() {
  if (noiseSuppressorInstance) {
    noiseSuppressorInstance.destroy();
    noiseSuppressorInstance = null;
  }
}

export default NoiseSuppressor;