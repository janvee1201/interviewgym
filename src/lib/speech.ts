// Speech recognition, microphone audio level analysis, and text-to-speech helpers

export interface SpeechController {
  start: () => Promise<boolean>;
  stop: () => void;
  isListening: boolean;
}

export class VoiceRecognizer {
  private recognition: any = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animFrameId: number | null = null;

  public isListening = false;
  public transcript = '';
  public audioLevel = 0; // 0 to 100
  public onTranscriptUpdate?: (text: string, isFinal: boolean) => void;
  public onLevelUpdate?: (level: number) => void;
  public onError?: (error: string) => void;

  constructor() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event: any) => {
          let currentInterim = '';
          let currentFinal = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            const transcriptChunk = result[0].transcript;
            if (result.isFinal) {
              currentFinal += transcriptChunk + ' ';
            } else {
              currentInterim += transcriptChunk;
            }
          }

          if (currentFinal) {
            this.transcript = (this.transcript + ' ' + currentFinal).trim();
            this.onTranscriptUpdate?.(this.transcript, true);
          } else if (currentInterim) {
            this.onTranscriptUpdate?.((this.transcript + ' ' + currentInterim).trim(), false);
          }
        };

        this.recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            this.onError?.('Microphone access denied. Please allow microphone permission in your browser.');
          } else if (event.error === 'no-speech') {
            // Keep listening or ignore
          } else {
            this.onError?.(`Speech recognition error: ${event.error}`);
          }
        };

        this.recognition.onend = () => {
          if (this.isListening) {
            // Restart if user hasn't explicitly stopped
            try {
              this.recognition.start();
            } catch {
              // Ignore if already active
            }
          }
        };
      } catch (err) {
        console.warn('Could not initialize SpeechRecognition:', err);
      }
    }
  }

  async start(): Promise<boolean> {
    this.transcript = '';
    this.isListening = true;

    // 1. Request microphone access for audio visualizer (graceful fallback if blocked)
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.setupAudioAnalysis(this.mediaStream);
      }
    } catch (err: any) {
      console.warn('Microphone audio visualizer stream error:', err);
      if (err.name === 'NotAllowedError') {
        this.onError?.('Microphone permission was denied. Please allow microphone access in your browser settings.');
      }
      // If recognition is not available either, stop here
      if (!this.recognition) {
        this.isListening = false;
        return false;
      }
    }

    // 2. Start SpeechRecognition
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (err: any) {
        console.warn('SpeechRecognition start error:', err);
      }
    } else {
      this.onError?.('Speech recognition is not supported in this browser. You can type or paste your response directly.');
    }

    return true;
  }

  private setupAudioAnalysis(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      
      // On mobile browsers, AudioContext starts suspended and must be resumed
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkLevel = () => {
        if (!this.isListening || !this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        this.audioLevel = normalized;
        this.onLevelUpdate?.(normalized);
        this.animFrameId = requestAnimationFrame(checkLevel);
      };

      this.animFrameId = requestAnimationFrame(checkLevel);
    } catch (err) {
      console.warn('AudioContext setup error:', err);
    }
  }

  stop(): string {
    this.isListening = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn('SpeechRecognition stop error:', err);
      }
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (err) {
        console.warn('AudioContext close error:', err);
      }
      this.audioContext = null;
    }

    this.audioLevel = 0;
    this.onLevelUpdate?.(0);

    return this.transcript.trim();
  }

  static isSupported(): boolean {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }
}

// Text to Speech
export function speakText(text: string, onEnd?: () => void): SpeechSynthesisUtterance | null {
  if (!('speechSynthesis' in window)) return null;

  window.speechSynthesis.cancel(); // cancel previous

  const cleanText = text.replace(/[*_#`]/g, '').trim();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.lang = 'en-US';

  // pick a natural English voice if available
  const voices = window.speechSynthesis.getVoices();
  const naturalVoice = voices.find(
    (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))
  ) || voices.find((v) => v.lang.startsWith('en'));

  if (naturalVoice) {
    utterance.voice = naturalVoice;
  }

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }

  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
