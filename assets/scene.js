/* SELENE — raymarched WebGL lunar lamp. No dependencies.
   One fragment shader: cratered glowing moon, levitation ring + platter, star field, drifting motes,
   nebula, optional 1-bit ordered-dither mode. Camera and state are driven from main.js. */
(function () {
  const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

  const FRAG = `
precision highp float;
uniform vec2  uRes, uOff, uMouse;
uniform float uTime, uSpin, uZoom, uCamY, uOrbit, uLookY, uRoll, uLight, uPx, uVel, uRing, uCrater, uGlowAmt, uBob, uMag;
uniform vec3  uGlow;

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float h13(vec3 p){ p=fract(p*.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
vec3  h33(vec3 p){ p=fract(p*vec3(.1031,.1030,.0973)); p+=dot(p,p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
float vnoise(vec3 p){
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x),mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x),mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+17.1; a*=.5; } return s; }

// cellular craters on a unit sphere (2x2x2 neighbourhood search keeps it cheap)
float craters(vec3 p, float sc){
  vec3 x=p*sc, c=floor(x), f=fract(x), base=c-step(f,vec3(.5));
  float h=0.;
  for(int i=0;i<2;i++) for(int j=0;j<2;j++) for(int k=0;k<2;k++){
    vec3 cell=base+vec3(float(i),float(j),float(k));
    vec3 r=h33(cell);
    vec3 cen=cell+.25+.5*r;
    float rad=.16+.30*h13(cell+7.7);
    float d=length(x-cen)/rad;
    float bowl=-(1.-smoothstep(.15,1.,d))*.85;
    float rq=(d-1.06)*4.5;
    float rim=exp(-rq*rq)*.42;
    h+=(bowl+rim)*step(.38,r.z);
  }
  return h;
}
float height(vec3 p){
  return craters(p,3.0)*.95 + craters(p,7.3)*.5 + craters(p,16.)*.22 + (fbm(p*2.6)-.5)*.55;
}

float sdTorus(vec3 p, vec2 t){ vec2 q=vec2(length(p.xz)-t.x,p.y); return length(q)-t.y; }
float sdPlatter(vec3 p, float R){
  vec2 d=vec2(length(p.xz)-R, abs(p.y)-.05);
  return min(max(d.x,d.y),0.)+length(max(d,0.))-.04;
}

float platY(){ return mix(-1.07,-1.62,uMag)-(1.-uRing)*2.6; }
float bobY(){ return uBob*uMag*(.09*sin(uTime*1.25)+.03*sin(uTime*2.1)); }
// x: distance, y: material  (1 moon, 2 ring, 3 platter)
vec2 map(vec3 p){
  float dm=length(p-vec3(0.,bobY(),0.))-1.;
  float ringY=-1.62-(1.-uRing*uMag)*2.6;
  float dr=sdTorus(p-vec3(0.,ringY,0.),vec2(.9,.024));
  float dp=sdPlatter(p-vec3(0.,platY()-.14,0.),mix(.62,1.18,uMag));
  vec2 r=vec2(dm,1.);
  if(dr<r.x) r=vec2(dr,2.);
  if(dp<r.x) r=vec2(dp,3.);
  return r;
}
float ringD(vec3 p){ return sdTorus(p-vec3(0.,-1.62-(1.-uRing*uMag)*2.6,0.),vec2(.9,.024)); }

vec3 nrm(vec3 p){
  vec2 e=vec2(1,-1)*.0012;
  return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);
}

vec3 stars(vec3 rd){
  vec3 col=vec3(0.);
  for(int i=0;i<3;i++){
    float sc=70.+float(i)*60.;
    vec3 p=rd*sc, id=floor(p), r=h33(id+float(i)*13.7);
    float d=length(p-(id+.5+(r-.5)*.4));
    float tw=.55+.45*sin(uTime*(1.+r.x*3.)+r.y*30.);
    float on=step(.80,r.z);
    vec3 tint=mix(vec3(.75,.85,1.),vec3(1.,.85,.7),r.x);
    col+=tint*pow(max(0.,1.-d*1.9)+1e-5,7.)*on*tw*(.7+1.6*r.x);
  }
  return col;
}
vec3 motes(vec3 ro, vec3 rd){
  vec3 col=vec3(0.);
  for(int i=0;i<3;i++){
    float fi=float(i);
    vec3 pp=(ro+rd*(1.6+fi*1.9))*(1.8+fi*.35)+vec3(fi*5.,uTime*(.05+.03*fi)-uCamY*2.,0.);
    vec3 cell=floor(pp), r=h33(cell);
    float d=length(pp-(cell+.32+.36*r));
    float sp=step(.80,r.z)*(.5+.5*sin(uTime*(.6+r.x*1.4)+r.y*20.));
    col+=uGlow*exp(-d*d*(130.-fi*25.))*sp*(.9+.3*fi);
  }
  return col;
}

float b2(vec2 p){ p=floor(mod(p,2.)); return mod(p.x*2.+p.y*3.,4.)/4.; }
float bayer(vec2 p){ return b2(p)+.25*b2(floor(p*.5))+1./32.; }

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  uv-=uOff;
  uv*=rot(uRoll);

  // fluid orbit camera
  vec3 ro=vec3(0.,0.,4.7-uZoom);
  ro.yz*=rot(uCamY);
  ro.xz*=rot(uOrbit+uMouse.x*.28);
  ro.y+=uMouse.y*.3;
  vec3 ta=vec3(0.,uLookY,0.);
  vec3 ww=normalize(ta-ro), uu=normalize(cross(ww,vec3(0,1,0))), vv=cross(uu,ww);
  float fov=1.8-uVel*.42;
  vec3 rd=normalize(uv.x*uu+uv.y*vv+fov*ww);

  // background: deep night + nebula tinted by the lamp + stars + motes
  float neb=fbm(rd*1.9+vec3(0.,0.,uTime*.012)+uOrbit*.3);
  vec3 bg=vec3(.006,.007,.014)+uGlow*smoothstep(.42,.95,neb)*.085*uGlowAmt+vec3(.02,.03,.06)*neb*.5;
  bg+=stars(rd)*.9;
  bg+=motes(ro,rd);

  // march
  float t=0., glowAcc=0.; vec2 hit=vec2(0.); bool hitF=false;
  for(int i=0;i<84;i++){
    vec3 pp=ro+rd*t;
    vec2 m=map(pp);
    float dr=ringD(pp);
    glowAcc+=max(m.x,.02)*uRing*uMag*.045/(.012+dr*dr);
    if(m.x<.0016){ hit=m; hitF=true; break; }
    t+=m.x;
    if(t>14.) break;
  }

  // lamp halo (closest approach to the moon's centre)
  vec3 mc=vec3(0.,bobY(),0.);
  float dmin=length(cross(rd,mc-ro));
  float edge=max(dmin-1.,0.);
  vec3 halo=uGlow*uGlowAmt*(exp(-edge*3.2)*.62+exp(-edge*.85)*.2);

  vec3 col=bg+halo;
  float isHit=0., frM=0.;

  if(hitF){
    vec3 p=ro+rd*t, n=nrm(p);
    if(hit.y<1.5){
      // MOON — lit from inside, textured with real bump
      vec3 q=p-mc; q.xz*=rot(-uSpin);
      vec3 nl=normalize(q);
      float e=.01;
      float h0=height(nl);
      vec3 g=vec3(height(nl+vec3(e,0,0))-h0,height(nl+vec3(0,e,0))-h0,height(nl+vec3(0,0,e))-h0)/e;
      g-=nl*dot(g,nl);
      vec3 bl=normalize(nl-g*.055*uCrater);
      vec3 bw=bl; bw.xz*=rot(uSpin);
      float maria=smoothstep(.46,.62,fbm(nl*1.35+3.1));
      vec3 alb=mix(vec3(.86,.84,.80),vec3(.40,.40,.42),maria*.75);
      alb*=.78+.22*smoothstep(-.6,.4,h0);
      vec3 L=normalize(vec3(-.55,.55,.75));
      float dif=max(dot(bw,L),0.);
      float fr=pow(1.-max(dot(n,-rd),0.),2.6);
      isHit=1.; frM=fr;
      float inner=.62+.55*max(dot(bw,-rd),0.)+.25*(1.-smoothstep(-.5,0.,h0));
      vec3 lamp=uGlow*uGlowAmt*inner;
      col=alb*(lamp*1.5+vec3(.78,.86,1.)*dif*.42+.02)+uGlow*fr*uGlowAmt*.9;
      col+=vec3(1.)*pow(max(dot(reflect(rd,bw),L),0.),38.)*.18;
    } else if(hit.y<2.5){
      isHit=1.;
      col=uGlow*1.7+vec3(.25);
    } else {
      isHit=1.;
      float r=length(p.xz);
      vec3 rn=n;
      float fr=pow(1.-max(dot(rn,-rd),0.),3.);
      vec3 wood=vec3(.20,.105,.05)*(.7+.6*vnoise(vec3(p.x*9.,p.z*1.2,0.)))+uGlow*uGlowAmt*.1;
      vec3 dark=vec3(.012,.012,.016)+vec3(.35,.4,.5)*fr*.18;
      col=mix(wood,dark,uMag)+uGlow*uGlowAmt*.5*exp(-r*1.9)*uMag;
      col+=uGlow*exp(-abs(r-.9)*22.)*.35*uRing*uMag;
    }
  }
  col+=uGlow*glowAcc*.035;
  vec3 bone=vec3(.925,.91,.875);
  col*=1.-uLight*isHit*(.28+.55*frM);     // inked silhouette in paper mode

  col=1.-exp(-col*1.35);                 // filmic soft clip
  col=mix(col,bone,uLight*(1.-isHit));   // bone paper behind the object
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
    ['uRes', 'uTime', 'uSpin', 'uZoom', 'uCamY', 'uOrbit', 'uLookY', 'uRoll', 'uLight', 'uPx', 'uVel', 'uRing',
      'uCrater', 'uGlowAmt', 'uBob', 'uMag', 'uOff', 'uMouse', 'uGlow'].forEach(n => (U[n] = gl.getUniformLocation(prog, n)));

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
      gl.uniform1f(U.uRing, s.ring);
      gl.uniform1f(U.uCrater, s.crater);
      gl.uniform1f(U.uGlowAmt, s.glowAmt);
      gl.uniform1f(U.uBob, s.bob);
      gl.uniform1f(U.uMag, s.mag);
      gl.uniform2f(U.uOff, s.ox, s.oy);
      gl.uniform2f(U.uMouse, s.mx, s.my);
      gl.uniform3f(U.uGlow, s.glow[0], s.glow[1], s.glow[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // adaptive quality: main.js reports frame time, we trade resolution for smoothness
    function quality(ms) {
      if (ms > 26 && budget > 4e5) { budget *= .82; resize(); }
      else if (ms < 13 && budget < 1.4e6) { budget *= 1.04; resize(); }
    }
    return { render, quality };
  }
  window.SeleneScene = { init };
})();
