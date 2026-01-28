// public/rnnoise/rnnoise-worklet-processor.js
// RNNoise AudioWorklet Processor
// ✅ FIXED: Receives WASM binary from main thread instead of fetching (fetch not available in worklet)

class RNNoiseWorkletProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    
    this.rnnoiseModule = null;
    this.rnnoiseState = null;
    this.inputBuffer = null;
    this.outputBuffer = null;
    this.bufferIndex = 0;
    this.initialized = false;
    this.destroyed = false;
    
    // RNNoise requires 480 samples per frame (10ms at 48kHz)
    this.FRAME_SIZE = 480;
    
    // ✅ Get WASM binary from processorOptions (loaded in main thread)
    const wasmBinary = options?.processorOptions?.wasmBinary;
    
    if (wasmBinary) {
      console.log("[RNNoise Worklet] Received WASM binary:", wasmBinary.byteLength, "bytes");
      this.initializeRNNoise(wasmBinary);
    } else {
      console.error("[RNNoise Worklet] No WASM binary provided - will passthrough audio");
      this.port.postMessage({ type: "error", error: "No WASM binary provided" });
    }
    
    // Handle messages from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === "destroy") {
        this.destroy();
      }
    };
  }
  
  async initializeRNNoise(wasmBinary) {
    try {
      console.log("[RNNoise Worklet] Initializing WASM module...");
      
      // ✅ Instantiate WASM from the provided binary
      const wasmModule = await WebAssembly.instantiate(wasmBinary, {
        env: {
          // RNNoise requires these imports
          memory: new WebAssembly.Memory({ initial: 256, maximum: 256 }),
          abort: () => console.error("[RNNoise] WASM abort called"),
          // Math functions that WASM might need
          exp: Math.exp,
          log: Math.log,
          pow: Math.pow,
          sin: Math.sin,
          cos: Math.cos,
          floor: Math.floor,
          ceil: Math.ceil,
          sqrt: Math.sqrt,
          fabs: Math.abs,
          fabsf: Math.abs,
          expf: Math.exp,
          logf: Math.log,
          powf: Math.pow,
          sinf: Math.sin,
          cosf: Math.cos,
          floorf: Math.floor,
          ceilf: Math.ceil,
          sqrtf: Math.sqrt,
          tanhf: Math.tanh,
          tanh: Math.tanh,
        },
      });
      
      this.rnnoiseModule = wasmModule.instance.exports;
      
      // Create RNNoise state
      if (this.rnnoiseModule.rnnoise_create) {
        this.rnnoiseState = this.rnnoiseModule.rnnoise_create();
        console.log("[RNNoise Worklet] RNNoise state created:", this.rnnoiseState);
      } else {
        console.error("[RNNoise Worklet] rnnoise_create function not found in WASM");
        throw new Error("rnnoise_create not found");
      }
      
      // Allocate buffers in WASM memory
      this.inputBuffer = new Float32Array(this.FRAME_SIZE);
      this.outputBuffer = new Float32Array(this.FRAME_SIZE);
      
      this.initialized = true;
      this.port.postMessage({ type: "ready" });
      console.log("[RNNoise Worklet] ✅ Initialization complete");
      
    } catch (error) {
      console.error("[RNNoise Worklet] WASM initialization failed:", error);
      this.port.postMessage({ type: "error", error: error.message });
      this.initialized = false;
    }
  }
  
  process(inputs, outputs, parameters) {
    // Check if destroyed
    if (this.destroyed) {
      return false; // Stop processing
    }
    
    const input = inputs[0];
    const output = outputs[0];
    
    // If no input or not initialized, passthrough
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }
    
    // If RNNoise not initialized, passthrough audio
    if (!this.initialized || !this.rnnoiseModule || !this.rnnoiseState) {
      // Passthrough: copy input to output
      for (let channel = 0; channel < output.length; channel++) {
        if (input[channel]) {
          output[channel].set(input[channel]);
        }
      }
      return true;
    }
    
    // Process first channel only (RNNoise is mono)
    const inputChannel = input[0];
    const outputChannel = output[0];
    
    try {
      // Process samples through RNNoise
      for (let i = 0; i < inputChannel.length; i++) {
        // Accumulate samples into frame buffer
        this.inputBuffer[this.bufferIndex] = inputChannel[i];
        this.bufferIndex++;
        
        // When we have a full frame, process it
        if (this.bufferIndex >= this.FRAME_SIZE) {
          this.processFrame();
          this.bufferIndex = 0;
        }
        
        // Output from processed buffer
        outputChannel[i] = this.outputBuffer[i % this.FRAME_SIZE];
      }
      
    } catch (error) {
      console.error("[RNNoise Worklet] Processing error:", error);
      // On error, passthrough
      outputChannel.set(inputChannel);
    }
    
    // Copy to other channels if needed
    for (let channel = 1; channel < output.length; channel++) {
      output[channel].set(outputChannel);
    }
    
    return true;
  }
  
  processFrame() {
    if (!this.rnnoiseModule || !this.rnnoiseState) {
      // Passthrough if not initialized
      this.outputBuffer.set(this.inputBuffer);
      return;
    }
    
    try {
      // RNNoise expects input scaled to [-32768, 32767] (16-bit range)
      // Web Audio uses [-1, 1] range
      const scaledInput = new Float32Array(this.FRAME_SIZE);
      for (let i = 0; i < this.FRAME_SIZE; i++) {
        scaledInput[i] = this.inputBuffer[i] * 32768;
      }
      
      // Call RNNoise process function
      // Different WASM builds might have different function names
      let vad = 0;
      if (this.rnnoiseModule.rnnoise_process_frame) {
        // Standard RNNoise API
        vad = this.rnnoiseModule.rnnoise_process_frame(
          this.rnnoiseState,
          scaledInput,
          scaledInput
        );
      } else if (this.rnnoiseModule._rnnoise_process_frame) {
        // Emscripten-style naming
        vad = this.rnnoiseModule._rnnoise_process_frame(
          this.rnnoiseState,
          scaledInput,
          scaledInput
        );
      } else {
        // Fallback: passthrough
        this.outputBuffer.set(this.inputBuffer);
        return;
      }
      
      // Scale back to [-1, 1] range
      for (let i = 0; i < this.FRAME_SIZE; i++) {
        this.outputBuffer[i] = scaledInput[i] / 32768;
      }
      
      // Send VAD status occasionally (not every frame to reduce overhead)
      if (Math.random() < 0.1) {
        this.port.postMessage({ type: "vad", isSpeech: vad > 0.5 });
      }
      
    } catch (error) {
      console.error("[RNNoise Worklet] Frame processing error:", error);
      // On error, passthrough
      this.outputBuffer.set(this.inputBuffer);
    }
  }
  
  destroy() {
    console.log("[RNNoise Worklet] Destroying...");
    this.destroyed = true;
    
    if (this.rnnoiseModule && this.rnnoiseState) {
      try {
        if (this.rnnoiseModule.rnnoise_destroy) {
          this.rnnoiseModule.rnnoise_destroy(this.rnnoiseState);
        } else if (this.rnnoiseModule._rnnoise_destroy) {
          this.rnnoiseModule._rnnoise_destroy(this.rnnoiseState);
        }
      } catch (e) {
        console.warn("[RNNoise Worklet] Error destroying state:", e);
      }
    }
    
    this.rnnoiseModule = null;
    this.rnnoiseState = null;
    this.inputBuffer = null;
    this.outputBuffer = null;
    this.initialized = false;
  }
}

registerProcessor("rnnoise-worklet-processor", RNNoiseWorkletProcessor);