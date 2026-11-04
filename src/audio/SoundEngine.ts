/**
 * 技能 / 战斗音效引擎
 *
 * 全部音色由 Web Audio API 实时合成（振荡器 + 噪声 + 包络），不依赖任何
 * 外部音频文件，因此离线可用、体积为零、也不涉及二进制资源生成。
 *
 * 浏览器自动播放策略要求 AudioContext 在用户手势中创建/恢复：
 * 点击「开始战斗」或音效开关时调用 unlock() 即可。
 */
export type SoundKind =
  | "hit"
  | "crit"
  | "skill"
  | "heal"
  | "buff"
  | "control"
  | "death"
  | "victory"
  | "defeat";

interface ToneOpts {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  attack?: number;
}

interface NoiseOpts {
  dur: number;
  gain?: number;
  filter?: number;
  type?: BiquadFilterType;
  delay?: number;
}

class BattleSoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlayed = new Map<SoundKind, number>();
  private enabled = true;
  private volume = 0.35;

  constructor() {
    if (typeof window !== "undefined") {
      this.enabled = localStorage.getItem("g3-sound") !== "false";
      const stored = Number(localStorage.getItem("g3-volume"));
      if (Number.isFinite(stored) && stored > 0) {
        this.volume = Math.min(1, stored);
      }
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get currentVolume(): number {
    return this.volume;
  }

  /** 必须在用户手势回调中调用，用于解锁浏览器自动播放限制 */
  unlock(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (typeof window !== "undefined") {
      localStorage.setItem("g3-sound", String(v));
    }
    if (v) this.unlock();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (typeof window !== "undefined") {
      localStorage.setItem("g3-volume", String(this.volume));
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  private getNoise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const len = Math.floor(ctx.sampleRate * 0.5);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  private tone(ctx: AudioContext, o: ToneOpts): void {
    if (!this.master) return;
    const start = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(o.freq, start);
    if (o.to && o.to > 0) {
      osc.frequency.exponentialRampToValueAtTime(o.to, start + o.dur);
    }
    const peak = o.gain ?? 0.12;
    const atk = o.attack ?? 0.008;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(start);
    osc.stop(start + o.dur + 0.02);
  }

  private noise(ctx: AudioContext, o: NoiseOpts): void {
    if (!this.master) return;
    const start = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = o.type ?? "bandpass";
    filter.frequency.value = o.filter ?? 1200;
    filter.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain ?? 0.1, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(start);
    src.stop(start + o.dur + 0.02);
  }

  /** 播放一个音效；同类音效带最小间隔限流，避免同帧大量伤害刷爆 */
  play(kind: SoundKind): void {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
      return;
    }
    const nowMs = ctx.currentTime * 1000;
    const minGap =
      kind === "hit" ? 90 : kind === "crit" ? 110 : kind === "death" ? 160 : 55;
    if (nowMs - (this.lastPlayed.get(kind) ?? -1e9) < minGap) return;
    this.lastPlayed.set(kind, nowMs);

    switch (kind) {
      case "hit": // 普攻命中：短噪声 + 低频撞击
        this.noise(ctx, { dur: 0.06, gain: 0.075, filter: 1500 });
        this.tone(ctx, {
          freq: 170,
          to: 70,
          dur: 0.09,
          type: "triangle",
          gain: 0.11,
        });
        break;
      case "crit": // 暴击：金属噪声 + 高频 ping + 下坠
        this.noise(ctx, { dur: 0.13, gain: 0.15, filter: 2800 });
        this.tone(ctx, {
          freq: 920,
          to: 300,
          dur: 0.14,
          type: "square",
          gain: 0.075,
        });
        this.tone(ctx, {
          freq: 1480,
          to: 1180,
          dur: 0.2,
          type: "sine",
          gain: 0.1,
          delay: 0.02,
        });
        break;
      case "skill": // 技能起手：上扬扫频 + 气流
        this.tone(ctx, {
          freq: 210,
          to: 880,
          dur: 0.26,
          type: "sawtooth",
          gain: 0.085,
        });
        this.tone(ctx, {
          freq: 440,
          to: 1320,
          dur: 0.22,
          type: "sine",
          gain: 0.06,
          delay: 0.03,
        });
        this.noise(ctx, { dur: 0.16, gain: 0.05, filter: 3200 });
        break;
      case "heal": // 治疗：明亮大三和弦
        [523.25, 659.25, 783.99].forEach((f, i) =>
          this.tone(ctx, {
            freq: f,
            dur: 0.42,
            type: "sine",
            gain: 0.055,
            delay: i * 0.045,
          })
        );
        this.tone(ctx, {
          freq: 1046.5,
          dur: 0.3,
          type: "sine",
          gain: 0.035,
          delay: 0.14,
        });
        break;
      case "buff": // 增益：上行琶音
        [392, 523.25, 659.25].forEach((f, i) =>
          this.tone(ctx, {
            freq: f,
            dur: 0.16,
            type: "triangle",
            gain: 0.08,
            delay: i * 0.06,
          })
        );
        break;
      case "control": // 控制：低沉下坠 + 闷响
        this.tone(ctx, {
          freq: 620,
          to: 90,
          dur: 0.4,
          type: "square",
          gain: 0.075,
        });
        this.tone(ctx, {
          freq: 120,
          to: 60,
          dur: 0.36,
          type: "sawtooth",
          gain: 0.055,
        });
        this.noise(ctx, {
          dur: 0.22,
          gain: 0.045,
          filter: 320,
          type: "lowpass",
        });
        break;
      case "death": // 阵亡：下坠 + 沉闷噪声
        this.tone(ctx, {
          freq: 420,
          to: 60,
          dur: 0.55,
          type: "triangle",
          gain: 0.14,
        });
        this.noise(ctx, {
          dur: 0.3,
          gain: 0.085,
          filter: 500,
          type: "lowpass",
        });
        break;
      case "victory": // 胜利：大三和弦上行
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          this.tone(ctx, {
            freq: f,
            dur: 0.34,
            type: "triangle",
            gain: 0.075,
            delay: i * 0.1,
          })
        );
        break;
      case "defeat": // 失败：小调下行
        [440, 392, 329.63, 261.63].forEach((f, i) =>
          this.tone(ctx, {
            freq: f,
            dur: 0.4,
            type: "sine",
            gain: 0.08,
            delay: i * 0.12,
          })
        );
        break;
    }
  }
}

export const sound = new BattleSoundEngine();
