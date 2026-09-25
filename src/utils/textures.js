import * as THREE from 'three';

export function makeCoilEndTexture(size = 1024) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const cx = size / 2, cy = size / 2, maxR = size * 0.49;
    const bg = ctx.createRadialGradient(cx, cy, size * 0.02, cx, cy, maxR);
    bg.addColorStop(0, '#e7eaec');
    bg.addColorStop(0.42, '#bcc1c4');
    bg.addColorStop(0.75, '#959da3');
    bg.addColorStop(1, '#6d757b');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fill();

    const rings = 100;
    for (let i = 1; i <= rings; i++) {
        const r = maxR * (i / rings);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        const alt = i % 2 === 0;
        ctx.strokeStyle = alt ? 'rgba(30,33,35,0.32)' : 'rgba(255,255,255,0.16)';
        ctx.lineWidth = size * 0.0012 * (1 + Math.random() * 0.7);
        ctx.stroke();
    }

    ctx.save();
    ctx.translate(cx, cy);
    const spokes = 160;
    for (let i = 0; i < spokes; i++) {
        ctx.rotate((Math.PI * 2) / spokes);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.02 + Math.random() * 0.05) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(size * 0.06, 0);
        ctx.lineTo(maxR, 0);
        ctx.stroke();
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.085, 0, Math.PI * 2);
    ctx.fillStyle = '#33373b';
    ctx.fill();
    ctx.lineWidth = size * 0.008;
    ctx.strokeStyle = '#1c1e20';
    ctx.stroke();

    for (let i = 0; i < 6; i++) {
        const a = i * (Math.PI * 2 / 6);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * size * 0.055, cy + Math.sin(a) * size * 0.055, size * 0.012, 0, Math.PI * 2);
        ctx.fillStyle = '#111213';
        ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

export function makeCoilSideTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#c9cdd0');
    g.addColorStop(0.5, '#9aa0a4');
    g.addColorStop(1, '#c2c6c9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 128);

    for (let i = 0; i < 400; i++) {
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.03 + Math.random() * 0.05) + ')';
        ctx.beginPath();
        const y = Math.random() * 128;
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 1);
    return tex;
}

export function makeStripTexture() {
    const w = 1024, h = 128;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#eef1f3');
    g.addColorStop(0.5, '#cdd2d5');
    g.addColorStop(1, '#e3e7e9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 900; i++) {
        ctx.strokeStyle = (Math.random() > 0.5 ? 'rgba(255,255,255,' : 'rgba(120,128,134,') + (0.05 + Math.random() * 0.10) + ')';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(Math.random() * w, 0);
        ctx.lineTo(Math.random() * w, h);
        ctx.stroke();
    }

    for (let x = 0; x < w; x += 64) {
        ctx.strokeStyle = 'rgba(70,76,80,0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 6);
        ctx.lineTo(x, h - 6);
        ctx.stroke();
    }

    for (let x = 0; x < w; x += 256) {
        ctx.strokeStyle = 'rgba(40,44,47,0.28)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(40,44,47,0.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    return tex;
}

export function makeFloorTexture() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#33373a';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 3000; i++) {
        ctx.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.06) + ')';
        ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    return tex;
}

export function makeHazardTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(0, 0, 256, 32);
    ctx.fillStyle = '#d7a418';

    for (let x = -32; x < 256; x += 32) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, 32);
        ctx.lineTo(x + 16, 0);
        ctx.lineTo(x + 32, 0);
        ctx.lineTo(x + 16, 32);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 1);
    return tex;
}

export function makeAlertTexture() {
    const c = document.createElement('canvas');
    c.width = 4096; // Higher resolution for crispness
    c.height = 256;
    const ctx = c.getContext('2d');
    
    // Background (Dark LED off-state)
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, c.width, c.height);

    // Text (LED Glowing Red)
    ctx.fillStyle = '#ff2a1c';
    ctx.font = 'bold 180px monospace'; // Much larger text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PARTS OVERFLOW - MACHINE STOPPED', c.width / 2, c.height / 2 + 10); // +10 to optically center

    // Grid overlay for dot-matrix effect (softer, so it doesn't chop the text from afar)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i < c.width; i += 12) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, c.height); ctx.stroke();
    }
    for (let j = 0; j < c.height; j += 12) {
        ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(c.width, j); ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4; // Helps it look less blurry at a distance
    return tex;
}
