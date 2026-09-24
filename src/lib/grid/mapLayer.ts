import type {CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap} from 'maplibre-gl';
import type {GridFrame, GridVariable} from '@/types/domain';
import {adaptParticleCount, initialParticleCount, sampleGrid} from './interpolate';

type Position = {lng: number; lat: number; age: number};

function mercator(lng: number, lat: number): [number, number] {
  const x = (180 + lng) / 360;
  const y = (180 - 180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))) / 360;
  return [x, y];
}

function tokenColor(variable: GridVariable): [number, number, number, number] {
  const token = variable === 'wind' ? '--weather-wind-2' : variable === 'rain' ? '--weather-rain-3' : variable === 'temp' ? '--weather-temp-5' : '--weather-wave-2';
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim().replace('#', '');
  const hex = value.length >= 6 ? value : 'ffffff';
  const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : variable === 'wind' ? .78 : .48;
  return [parseInt(hex.slice(0, 2), 16) / 255 * alpha, parseInt(hex.slice(2, 4), 16) / 255 * alpha, parseInt(hex.slice(4, 6), 16) / 255 * alpha, alpha];
}

function shader(gl: WebGL2RenderingContext, type: number, source: string) {
  const result = gl.createShader(type);
  if (!result) throw new Error('WebGL shader allocation failed');
  gl.shaderSource(result, source); gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result) ?? 'WebGL shader compile failed');
  return result;
}

export class WeatherGridLayer implements CustomLayerInterface {
  readonly id = 'barum-weather-grid';
  readonly type = 'custom' as const;
  readonly renderingMode = '2d' as const;
  private map?: MapLibreMap;
  private program?: WebGLProgram;
  private buffer?: WebGLBuffer;
  private positionLocation = -1;
  private valueLocation = -1;
  private matrixLocation?: WebGLUniformLocation | null;
  private colorLocation?: WebGLUniformLocation | null;
  private sizeLocation?: WebGLUniformLocation | null;
  private frame?: GridFrame;
  private particles: Position[] = [];
  private activeCount = 0;
  private lastFrameAt = performance.now();
  private fpsSamples: number[] = [];
  private slowSeconds = 0;
  private fastSeconds = 0;

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext) {
    this.map = map;
    const vertex = shader(gl, gl.VERTEX_SHADER, `#version 300 es\nin vec2 a_pos;in float a_value;uniform mat4 u_matrix;uniform float u_size;out float v_value;void main(){gl_Position=u_matrix*vec4(a_pos,0.,1.);gl_PointSize=u_size;v_value=a_value;}`);
    const fragment = shader(gl, gl.FRAGMENT_SHADER, `#version 300 es\nprecision mediump float;uniform vec4 u_color;in float v_value;out vec4 outColor;void main(){float strength=clamp(v_value,0.,1.);outColor=vec4(mix(u_color.rgb*.35,u_color.rgb,strength),u_color.a);}`);
    const program = gl.createProgram();
    if (!program) throw new Error('WebGL program allocation failed');
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    this.program = program; this.buffer = gl.createBuffer() ?? undefined;
    this.positionLocation = gl.getAttribLocation(program, 'a_pos');
    this.valueLocation = gl.getAttribLocation(program, 'a_value');
    this.matrixLocation = gl.getUniformLocation(program, 'u_matrix'); this.colorLocation = gl.getUniformLocation(program, 'u_color'); this.sizeLocation = gl.getUniformLocation(program, 'u_size');
    const connection = (navigator as Navigator & {connection?: {saveData?: boolean}}).connection;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.activeCount = initialParticleCount(innerWidth, reduced, Boolean(connection?.saveData));
    this.resetParticles();
  }

  setFrame(frame: GridFrame) { this.frame = frame; this.resetParticles(); this.map?.triggerRepaint(); }

  private resetParticles() {
    if (!this.frame) return;
    const {bounds} = this.frame;
    this.particles = Array.from({length: 30_000}, () => ({lng: bounds.west + Math.random() * (bounds.east - bounds.west), lat: bounds.south + Math.random() * (bounds.north - bounds.south), age: Math.random() * 100}));
  }

  private staticField() {
    if (!this.frame) return new Float32Array();
    const vertices: number[] = [];
    for (let y = 0; y < this.frame.height; y += 1) for (let x = 0; x < this.frame.width; x += 1) {
      const lng = this.frame.bounds.west + x / (this.frame.width - 1) * (this.frame.bounds.east - this.frame.bounds.west);
      const lat = this.frame.bounds.north - y / (this.frame.height - 1) * (this.frame.bounds.north - this.frame.bounds.south);
      const u = sampleGrid(this.frame, lng, lat, 'u'), v = sampleGrid(this.frame, lng, lat, 'v');
      const speed = Math.min(1, Math.hypot(u, v) / 20);
      vertices.push(...mercator(lng, lat), speed, ...mercator(lng + u * .008, lat + v * .008), speed);
    }
    return new Float32Array(vertices);
  }

  private windVertices(deltaSeconds: number) {
    if (!this.frame) return new Float32Array();
    if (this.activeCount === 0) return this.staticField();
    const vertices = new Float32Array(this.activeCount * 6), {bounds} = this.frame;
    for (let index = 0; index < this.activeCount; index += 1) {
      const particle = this.particles[index];
      const previous = mercator(particle.lng, particle.lat);
      const u = sampleGrid(this.frame, particle.lng, particle.lat, 'u'), v = sampleGrid(this.frame, particle.lng, particle.lat, 'v');
      particle.lng += u * deltaSeconds * .018; particle.lat += v * deltaSeconds * .018; particle.age += deltaSeconds * 18;
      if (particle.lng > bounds.east || particle.lng < bounds.west || particle.lat > bounds.north || particle.lat < bounds.south || particle.age > 100) {
        particle.lng = bounds.west + Math.random() * (bounds.east - bounds.west); particle.lat = bounds.south + Math.random() * (bounds.north - bounds.south); particle.age = 0;
      }
      const current = mercator(particle.lng, particle.lat);
      const speed = Math.min(1, Math.hypot(u, v) / 20);
      vertices.set([...previous, speed, ...current, speed], index * 6);
    }
    return vertices;
  }

  private scalarVertices() {
    if (!this.frame) return new Float32Array();
    const vertices: number[] = [];
    for (let y = 0; y < this.frame.height; y += 1) for (let x = 0; x < this.frame.width; x += 1) {
      const lng = this.frame.bounds.west + x / (this.frame.width - 1) * (this.frame.bounds.east - this.frame.bounds.west);
      const lat = this.frame.bounds.north - y / (this.frame.height - 1) * (this.frame.bounds.north - this.frame.bounds.south);
      const value = this.frame.values[y * this.frame.width + x];
      const normalized = this.frame.variable === 'rain' ? value / 10 : this.frame.variable === 'temp' ? (value + 10) / 45 : value / 6;
      if (this.frame.variable !== 'rain' || value >= .1) vertices.push(...mercator(lng, lat), normalized);
    }
    return new Float32Array(vertices);
  }

  private measureFps(now: number) {
    const delta = Math.min(.1, (now - this.lastFrameAt) / 1000); this.lastFrameAt = now;
    if (delta > 0) this.fpsSamples.push(1 / delta);
    if (this.fpsSamples.length < 60) return delta;
    const fps = this.fpsSamples.reduce((sum, value) => sum + value, 0) / this.fpsSamples.length; this.fpsSamples = [];
    this.slowSeconds = fps < 45 ? this.slowSeconds + 1 : 0; this.fastSeconds = fps > 57 ? this.fastSeconds + 1 : 0;
    if (this.slowSeconds >= 2 || this.fastSeconds >= 5) { this.activeCount = adaptParticleCount(this.activeCount, fps); this.slowSeconds = 0; this.fastSeconds = 0; }
    return delta;
  }

  render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput) {
    if (!this.frame || !this.program || !this.buffer || document.hidden) return;
    const delta = this.measureFps(performance.now());
    const wind = this.frame.variable === 'wind';
    const vertices = wind ? this.windVertices(delta) : this.scalarVertices();
    gl.useProgram(this.program); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.positionLocation); gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 12, 0);
    gl.enableVertexAttribArray(this.valueLocation); gl.vertexAttribPointer(this.valueLocation, 1, gl.FLOAT, false, 12, 8);
    gl.uniformMatrix4fv(this.matrixLocation ?? null, false, options.modelViewProjectionMatrix as Float32Array);
    gl.uniform4fv(this.colorLocation ?? null, tokenColor(this.frame.variable)); gl.uniform1f(this.sizeLocation ?? null, wind ? 1 : 52);
    gl.drawArrays(wind ? gl.LINES : gl.POINTS, 0, vertices.length / 3);
    if (wind && this.activeCount > 0) this.map?.triggerRepaint();
  }

  onRemove(_map: MapLibreMap, gl: WebGL2RenderingContext) { if (this.buffer) gl.deleteBuffer(this.buffer); if (this.program) gl.deleteProgram(this.program); this.map = undefined; }
}
