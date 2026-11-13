/* GALE — raymarched WebGL neck fan. No dependencies.
   One fragment shader: glossy bladeless neck fan (open ring + fan heads), vent slits, LED strip,
   airflow halo, scroll-speed wind streaks, optional 1-bit ordered-dither "paper" mode.
   Camera and state are driven from main.js. */
(function () {
  const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

  const FRAG = `
precision highp float;
uniform vec2  uRes, uOff, uMouse;
uniform float uTime, uSpin, uZoom, uCamY, uOrbit, uLookY, uRoll, uLight, uPx, uVel, uBlow, uGlowAmt, uBob;
uniform vec3  uGlow, uBody;

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float h13(vec3 p){ p=fract(p*.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vnoise(vec3 p){
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x),mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x),mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float smin(float a,float b,float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }

// iq: capped torus, arc centred on +y, half-angle from sc=(sin,cos)
float sdCapTorus(vec3 p, vec2 sc, float ra, float rb){
  p.x=abs(p.x);
  float k=(sc.y*p.x>sc.x*p.y)?dot(p.xy,sc):length(p.xy);
  return sqrt(max(dot(p,p)+ra*ra-2.*ra*k,0.))-rb;
}
float sdTorus(vec3 p, vec2 t){ vec2 q=vec2(length(p.xz)-t.x,p.y); return length(q)-t.y; }

float bobY(){ return uBob*(.06*sin(uTime*1.3)+.02*sin(uTime*2.3)); }

// object-local space: spin, tilt, centre
vec3 loc(vec3 p){
  p.y-=bobY();
  p.xz*=rot(uSpin);
  p.yz*=rot(.34);
  p.z+=.12;
  return p;
}
const vec2 CAP=vec2(.636,-.772);           // sin/cos of 2.45 rad half-arc (opening at the front)
float fan(vec3 q){
  vec3 t=vec3(q.x,-q.z,q.y*1.45);         // ring in xz, arc centred on the back
  float body=sdCapTorus(t,CAP,.98,.2)*.72;
  float e1=length(q-vec3( .64,0.,.77))-.27;
  float e2=length(q-vec3(-.64,0.,.77))-.27;
  return smin(body,smin(e1,e2,.01),.14);
}
float map(vec3 p){ return fan(loc(p)); }

vec3 nrm(vec3 p){
  vec2 e=vec2(1,-1)*.0012;
  return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));
}

// procedural photo studio: soft boxes + accent rim lights
vec3 env(vec3 r){
  vec3 c=mix(vec3(.012,.014,.022),vec3(.075,.10,.15),r.y*.5+.5);
  c+=vec3(1.)*smoothstep(.45,.6,r.y)*smoothstep(1.,.5,abs(r.x))*1.7;
  c+=vec3(.9,.95,1.)*smoothstep(.03,.0,abs(r.y+.05))*.4;
  c+=uGlow*pow(max(dot(r,normalize(vec3(.9,.05,-.55))),0.),10.)*2.2;
  c+=uGlow*pow(max(dot(r,normalize(vec3(-.8,-.2,.6))),0.),14.)*1.4;
  return c;
}

// horizontal wind streaks, faster with scroll speed
vec3 wind(vec2 uv){
  vec3 col=vec3(0.);
  float spd=uTime*(.55+uVel*3.2);
  for(int i=0;i<3;i++){
    float fi=float(i);
    vec2 q=vec2(uv.x*(.8+fi*.35)+spd*(.5+fi*.4), uv.y*(13.+fi*10.));
    float row=floor(q.y);
    float h=h13(vec3(row,fi,7.3));
    float on=step(.74,h);
    float ly=abs(fract(q.y)-.5);
    float thin=smoothstep(.05,.0,ly);
    float t=fract(q.x*.35+h*9.);
    float s=pow(1.-t,4.)*smoothstep(0.,.015,t);
    col+=uGlow*on*thin*s*(.5-fi*.1)*(.55+uVel*2.2);
  }
  return col*uBlow;
}

float b2(vec2 p){ p=floor(mod(p,2.)); return mod(p.x*2.+p.y*3.,4.)/4.; }
float bayer(vec2 p){ return b2(p)+.25*b2(floor(p*.5))+1./32.; }

void main(){
  vec2 uv0=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec2 uv=uv0-uOff;
  uv*=rot(uRoll);

  vec3 ro=vec3(0.,0.,4.9-uZoom);
  ro.yz*=rot(uCamY);
  ro.xz*=rot(uOrbit+uMouse.x*.25);
  ro.y+=uMouse.y*.3;
  vec3 ta=vec3(0.,uLookY,0.);
  vec3 ww=normalize(ta-ro), uu=normalize(cross(ww,vec3(0,1,0))), vv=cross(uu,ww);
  float fov=1.8-uVel*.5;
  vec3 rd=normalize(uv.x*uu+uv.y*vv+fov*ww);

  // background: dark steel + accent fog + wind
  vec3 bg=mix(vec3(.008,.010,.016),vec3(.02,.04,.065),smoothstep(-.6,.7,uv0.y));
  bg+=uGlow*exp(-length(uv)*2.1)*.11*uGlowAmt;
  bg+=wind(uv0);

  // march
  float t=0., glowAcc=0.; bool hitF=false;
  for(int i=0;i<76;i++){
    vec3 pp=ro+rd*t;
    float d=map(pp);
    // airflow halo: soft ring rising inside the fan
    vec3 lp=loc(pp);
    float da=sdTorus(lp-vec3(0.,.16+.18*sin(uTime*2.+lp.x),-.08),vec2(.78,.05+.05*sin(uTime*3.)));
    glowAcc+=max(d,.02)*uBlow*.04/(.02+da*da);
    if(d<.0016){ hitF=true; break; }
    t+=d;
    if(t>14.) break;
  }

  vec3 col=bg;
  float isHit=0., fr=0.;

  if(hitF){
    isHit=1.;
    vec3 p=ro+rd*t, n=nrm(p);
    vec3 pl=loc(p);
    fr=pow(1.-max(dot(n,-rd),0.),3.);
    // tube-local coordinates: radial offset from the ring centre line, height
    float rad=length(pl.xz);
    vec2 tc=vec2(rad-.98,pl.y*1.45);
    float ang=atan(pl.x,-pl.z);

    // vent slits on the inner/lower side
    float slit=1.-smoothstep(.10,.2,abs(sin(ang*30.)));
    float zone=smoothstep(.02,-.10,tc.x)*smoothstep(.04,-.09,tc.y);
    float vent=slit*zone;
    // LED strip along the outer top
    float led=smoothstep(.035,.0,abs(tc.y-.13))*smoothstep(-.02,.06,tc.x);
    // soft pulse travelling round the strip
    led*=.65+.35*sin(ang*3.-uTime*3.);

    vec3 L=normalize(vec3(-.5,.8,.6));
    float dif=max(dot(n,L),0.);
    vec3 r=reflect(rd,n);
    float F=.04+.96*fr;
    vec3 body=uBody*(.18+.9*dif)+env(r)*mix(.25,.9,F);
    // fine soft-touch grain
    body*=.96+.08*vnoise(pl*90.);
    col=mix(body,vec3(.005,.006,.009),vent*.92);
    col+=uGlow*vent*.35*uBlow*(.5+.5*sin(uTime*6.+ang*30.));
    col+=uGlow*led*2.4*uGlowAmt;
  }

  col+=uGlow*glowAcc*.04;
  col*=1.-uLight*isHit*(.28+.55*fr);        // inked silhouette in paper mode

  col=1.-exp(-col*1.35);                    // filmic soft clip
  vec3 bone=vec3(.925,.91,.875);
  col=mix(col,bone,uLight*(1.-isHit));      // bone paper behind the object
  float lum=dot(col,vec3(.3,.59,.11));

  vec2 pp2=floor(gl_FragCoord.xy/uPx);
  float bay=bayer(pp2);
  float ink=step(bay,lum);
  vec3 mono=mix(vec3(.04,.035,.03),bone,ink);
  vec3 rgb=col+(bay-.5)/40.;
  rgb=mix(rgb,mono,uLight);

  vec2 q2=gl_FragCoord.xy/uRes-.5;
  rgb*=1.-dot(q2,q2)*.6*(1.-uLight*.55);
  gl_FragColor=vec4(rgb,1.);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  }

  function init(canvas) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT), fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
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
    ['uRes', 'uTime', 'uSpin', 'uZoom', 'uCamY', 'uOrbit', 'uLookY', 'uRoll', 'uLight', 'uPx', 'uVel', 'uBlow',
      'uGlowAmt', 'uBob', 'uOff', 'uMouse', 'uGlow', 'uBody'].forEach(n => (U[n] = gl.getUniformLocation(prog, n)));

    let scale = 1, budget = 1.0e6;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth, h = window.innerHeight;
      scale = Math.max(.45, Math.min(dpr, Math.sqrt(budget / (w * h))));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    function render(s) {
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, s.time);
      gl.uniform1f(U.uSpin, s.spin);
      gl.uniform1f(U.uZoom, s.zoom);
      gl.uniform1f(U.uCamY, s.camY);
      gl.uniform1f(U.uOrbit, s.orbit);
      gl.uniform1f(U.uLookY, s.lookY);
      gl.uniform1f(U.uRoll, s.roll);
      gl.uniform1f(U.uLight, s.light);
      gl.uniform1f(U.uPx, Math.max(2, Math.round(2.2 * scale + .4)));
      gl.uniform1f(U.uVel, s.vel);
      gl.uniform1f(U.uBlow, s.blow);
      gl.uniform1f(U.uGlowAmt, s.glowAmt);
      gl.uniform1f(U.uBob, s.bob);
      gl.uniform2f(U.uOff, s.ox, s.oy);
      gl.uniform2f(U.uMouse, s.mx, s.my);
      gl.uniform3f(U.uGlow, s.glow[0], s.glow[1], s.glow[2]);
      gl.uniform3f(U.uBody, s.body[0], s.body[1], s.body[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // adaptive quality: trade resolution for smoothness
    function quality(ms) {
      if (ms > 26 && budget > 4e5) { budget *= .82; resize(); }
      else if (ms < 13 && budget < 1.4e6) { budget *= 1.04; resize(); }
    }
    return { render, quality };
  }
  window.GaleScene = { init };
})();
