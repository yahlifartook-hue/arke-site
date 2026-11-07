/* ARKÉ — raymarched WebGL scene. No dependencies.
   One fragment shader draws a morphing liquid-chrome form, studio reflections,
   and an optional 1-bit ordered-dither mode. Camera is driven from main.js. */
(function () {
  const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

  const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime, uMorph, uSpin, uZoom, uCamY, uRoll, uLight, uPx, uVel;
uniform vec2  uOff, uMouse;

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float smin(float a,float b,float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
float sdTorus(vec3 p, vec2 t){ vec2 q=vec2(length(p.xz)-t.x,p.y); return length(q)-t.y; }
float sdRBox(vec3 p, vec3 b, float r){ vec3 q=abs(p)-b; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r; }

float sh(vec3 p, float i){
  if(i<.5) return length(p)-1.05;
  if(i<1.5) return sdTorus(p, vec2(.98,.36));
  if(i<2.5){ p.xz*=rot(p.y*1.15); return sdRBox(p, vec3(.6), .24); }
  float a=length(p-vec3(.5,.12,0.))-.72;
  float b=length(p+vec3(.5,.12,0.))-.72;
  float c=sdTorus(p.xzy, vec2(.9,.16));
  return smin(smin(a,b,.55), c, .35);
}

float map(vec3 p){
  p.xz*=rot(uSpin); p.yz*=rot(.38);
  float m=clamp(uMorph,0.,3.);
  float i=min(floor(m),2.);
  float f=smoothstep(0.,1.,m-i);
  float d=mix(sh(p,i), sh(p,i+1.), f);
  float w=sin(p.x*2.6+uTime*.9)*sin(p.y*2.9+uTime*1.1)*sin(p.z*2.7+uTime*.7);
  d+=w*(.06+uVel*.05);
  return d*.72;
}

vec3 nrm(vec3 p){
  vec2 e=vec2(1,-1)*.0016;
  return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));
}

// procedural photo studio: dark room, soft boxes, one hot red lamp
vec3 env(vec3 r){
  vec3 c=mix(vec3(.012,.010,.010), vec3(.10,.035,.025), r.y*.5+.5);
  c+=vec3(1.)*smoothstep(.50,.62,r.y)*smoothstep(1.0,.55,abs(r.x))*1.6;
  c+=vec3(1.,.95,.9)*smoothstep(.05,.0,abs(r.y+.05))*.45*smoothstep(1.,.2,abs(r.z));
  c+=vec3(1.,.16,.04)*pow(max(dot(r,normalize(vec3(-.65,.15,.75))),0.),14.)*3.2;
  c+=vec3(.55,.68,1.)*pow(max(dot(r,normalize(vec3(.85,-.1,-.55))),0.),12.)*1.3;
  c+=vec3(1.,.4,.2)*pow(max(-r.y,0.),3.)*.35;
  return c;
}

float b2(vec2 p){ p=floor(mod(p,2.)); return mod(p.x*2.+p.y*3.,4.)/4.; }
float bayer(vec2 p){ return b2(p)+.25*b2(floor(p*.5))+1./32.; }

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  uv-=uOff;
  uv*=rot(uRoll);

  vec3 ro=vec3(0.,uCamY,4.7-uZoom);
  ro.xz*=rot(uMouse.x*.35);
  ro.y+=uMouse.y*.35;
  vec3 ww=normalize(-ro), uu=normalize(cross(ww,vec3(0,1,0))), vv=cross(uu,ww);
  vec3 rd=normalize(uv.x*uu+uv.y*vv+1.8*ww);

  float t=0., d=1.; bool hit=false;
  for(int i=0;i<80;i++){
    d=map(ro+rd*t);
    if(d<.0018){ hit=true; break; }
    t+=d;
    if(t>10.) break;
  }

  vec3 darkBg=vec3(.028,.024,.022)+vec3(.30,.05,.015)*exp(-length(uv)*2.4);
  vec3 bone=vec3(.925,.91,.875);
  vec3 bg=mix(darkBg,bone,uLight);
  vec3 col=bg;

  if(hit){
    vec3 p=ro+rd*t, n=nrm(p);
    float fr=pow(1.-max(dot(n,-rd),0.),3.);
    vec3 r=reflect(rd,n);
    vec3 tint=mix(vec3(1.,.42,.32), vec3(1.), fr);
    col=env(r)*tint*(.35+.9*fr+.35);
    col+=vec3(1.,.25,.1)*fr*.35;
    col*=1.-.55*smoothstep(1.2,3.5,length(p)*.0+t-3.2)*.0;
  }

  col=pow(col,vec3(.92));
  float lum=dot(col,vec3(.3,.59,.11));

  vec2 pp=floor(gl_FragCoord.xy/uPx);
  float bay=bayer(pp);

  // light mode: 1-bit ink halftone on bone paper
  float ink = step(bay, lum);
  vec3 mono = mix(vec3(.04,.035,.03), bone, ink);
  vec3 rgb  = col + (bay-.5)/40.;           // de-band
  rgb = mix(rgb, mono, uLight);

  // vignette
  vec2 q=gl_FragCoord.xy/uRes-.5;
  rgb*=1.-dot(q,q)*.55*(1.-uLight*.6);

  gl_FragColor=vec4(rgb,1.);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function init(canvas) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return null; }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = {};
    ['uRes', 'uTime', 'uMorph', 'uSpin', 'uZoom', 'uCamY', 'uRoll', 'uLight', 'uPx', 'uVel', 'uOff', 'uMouse']
      .forEach(n => (U[n] = gl.getUniformLocation(prog, n)));

    let scale = 1;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = window.innerWidth, cssH = window.innerHeight;
      // keep ~1.1M shaded pixels so it stays smooth on phones
      scale = Math.min(dpr, Math.sqrt(1.1e6 / (cssW * cssH)));
      scale = Math.max(scale, .5);
      canvas.width = Math.round(cssW * scale);
      canvas.height = Math.round(cssH * scale);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    function render(s) {
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, s.time);
      gl.uniform1f(U.uMorph, s.morph);
      gl.uniform1f(U.uSpin, s.spin);
      gl.uniform1f(U.uZoom, s.zoom);
      gl.uniform1f(U.uCamY, s.camY);
      gl.uniform1f(U.uRoll, s.roll);
      gl.uniform1f(U.uLight, s.light);
      gl.uniform1f(U.uPx, Math.max(2, Math.round(2.2 * scale + .4)));
      gl.uniform1f(U.uVel, s.vel);
      gl.uniform2f(U.uOff, s.ox, s.oy);
      gl.uniform2f(U.uMouse, s.mx, s.my);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    return { render };
  }

  window.ArkeScene = { init };
})();
