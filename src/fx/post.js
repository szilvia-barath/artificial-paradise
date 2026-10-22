import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  NoiseEffect,
  VignetteEffect,
  ChromaticAberrationEffect,
  ToneMappingEffect,
  ToneMappingMode,
  BlendFunction,
  Effect,
} from 'postprocessing';

// Post chain: bloom + ACES tone mapping + vignette + film grain + a custom glitch pulse
// (blocky band displacement and colour tear, fired when you cross between rooms),
// then a separate pass for chromatic aberration (it samples at offset UVs).

const glitchFrag = /* glsl */ `
  uniform float pulse;
  uniform float seed;
  float gh(float n) { return fract(sin(n) * 43758.5453123); }
  void mainUv(inout vec2 uv) {
    if (pulse > 0.001) {
      float band = floor(uv.y * 22.0 + seed * 5.0);
      float on = step(1.0 - pulse * 0.75, gh(band + seed * 17.0));
      uv.x += on * (gh(band * 1.37 + seed) - 0.5) * 0.14 * pulse;
      vec2 block = floor(uv * vec2(14.0, 8.0));
      float b = step(1.0 - pulse * 0.25, gh(block.x * 7.0 + block.y * 13.0 + seed));
      uv += b * (vec2(gh(block.x + seed), gh(block.y - seed)) - 0.5) * 0.05;
    }
  }
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;
    if (pulse > 0.001) {
      float band = floor(uv.y * 22.0 + seed * 5.0);
      float on = step(1.0 - pulse * 0.75, gh(band + seed * 17.0));
      c = mix(c, vec3(c.g * 0.6, c.b * 1.3 + 0.05, c.r * 1.2), on * 0.7 * pulse);
      c += pulse * 0.05 * sin(uv.y * 900.0 + time * 80.0);
    }
    outputColor = vec4(c, inputColor.a);
  }
`;

class GlitchPulseEffect extends Effect {
  constructor() {
    super('GlitchPulseEffect', glitchFrag, {
      uniforms: new Map([
        ['pulse', new THREE.Uniform(0)],
        ['seed', new THREE.Uniform(0)],
      ]),
    });
  }
}

export function createPost(renderer, scene, camera, { lowPower }) {
  renderer.toneMapping = THREE.NoToneMapping;
  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
    multisampling: lowPower ? 0 : Math.min(4, renderer.capabilities.maxSamples),
  });
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new BloomEffect({
    mipmapBlur: true,
    luminanceThreshold: 0.82,
    luminanceSmoothing: 0.25,
    intensity: 0.85,
    radius: 0.72,
  });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.62 });
  const noise = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SCREEN });
  noise.blendMode.opacity.value = 0.22;
  const glitch = new GlitchPulseEffect();
  composer.addPass(new EffectPass(camera, bloom, glitch, tone, vignette, noise));

  const ca = new ChromaticAberrationEffect({
    offset: new THREE.Vector2(0.0006, 0.0004),
    radialModulation: true,
    modulationOffset: 0.25,
  });
  composer.addPass(new EffectPass(camera, ca));

  let pulse = 0;
  const baseCA = new THREE.Vector2(0.0006, 0.0004);
  return {
    composer,
    bloom,
    trigger(strength = 1) {
      pulse = Math.max(pulse, strength);
      glitch.uniforms.get('seed').value = Math.random() * 100;
    },
    update(dt, audio) {
      pulse = Math.max(0, pulse - dt * 1.8);
      const p = pulse * pulse;
      glitch.uniforms.get('pulse').value = p;
      const k = 1 + p * 9 + (audio ? audio.glitch * 2.5 : 0);
      ca.offset.set(baseCA.x * k, baseCA.y * k);
      if (Math.random() < 0.02) glitch.uniforms.get('seed').value = Math.random() * 100;
    },
    setSize(w, h) {
      composer.setSize(w, h, false);
    },
    render(dt) {
      composer.render(dt);
    },
  };
}
