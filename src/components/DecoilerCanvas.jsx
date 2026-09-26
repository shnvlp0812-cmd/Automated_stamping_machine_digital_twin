import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
    makeCoilEndTexture,
    makeCoilSideTexture,
    makeStripTexture,
    makeFloorTexture,
    makeHazardTexture,
    makeAlertTexture
} from '../utils/textures';
import { getPanelConfig } from '../utils/panelConfig';

// Disable modern color management to match the legacy r128 appearance where hex colors were treated as linear
THREE.ColorManagement.enabled = false;

export default function DecoilerCanvas({
    sliderRPM,
    isPlaying,
    onStatsUpdate,
    safeGuardVisible = true,
    selectedModel,
    emptyTrigger,
    modelChangeTrigger
}) {
    const containerRef = useRef(null);
    const speedRef = useRef(sliderRPM);
    const playingRef = useRef(isPlaying);
    const frontGuardRef = useRef(null);
    const selectedModelRef = useRef(selectedModel);
    const emptyTriggerRef = useRef(emptyTrigger);
    const lastEmptyTriggerRef = useRef(0);
    const modelChangeTriggerRef = useRef(modelChangeTrigger);
    const lastModelChangeTriggerRef = useRef(0);

    useEffect(() => {
        if (frontGuardRef.current) {
            frontGuardRef.current.visible = safeGuardVisible;
        }
    }, [safeGuardVisible]);

    useEffect(() => {
        speedRef.current = sliderRPM;
    }, [sliderRPM]);

    useEffect(() => {
        playingRef.current = isPlaying;
    }, [isPlaying]);

    useEffect(() => { selectedModelRef.current = selectedModel; }, [selectedModel]);
    useEffect(() => { emptyTriggerRef.current = emptyTrigger; }, [emptyTrigger]);
    useEffect(() => { modelChangeTriggerRef.current = modelChangeTrigger; }, [modelChangeTrigger]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        /* ===================== BASIC SETUP ===================== */
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1e22);
        scene.fog = new THREE.Fog(0x1a1e22, 14, 34);

        const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 100);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.localClippingEnabled = true;
        container.appendChild(renderer.domElement);

        const handleResize = () => {
            if (!container) return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        /* ===================== CUSTOM ORBIT CAMERA ===================== */
        const target = new THREE.Vector3(0.5, 1.7, 2.0);
        let camAzimuth = 0.58, camPolar = 1.2, camRadius = 12.5;
        const minPolar = 0.35, maxPolar = 1.5, minRadius = 4, maxRadius = 24;

        function updateCamera() {
            camera.position.set(
                target.x + camRadius * Math.sin(camPolar) * Math.sin(camAzimuth),
                target.y + camRadius * Math.cos(camPolar),
                target.z + camRadius * Math.sin(camPolar) * Math.cos(camAzimuth)
            );
            camera.lookAt(target);
        }
        updateCamera();

        let dragging = false, prevX = 0, prevY = 0;
        const onPointerDown = (e) => {
            dragging = true;
            prevX = e.clientX;
            prevY = e.clientY;
        };
        const onPointerUp = () => { dragging = false; };
        const onPointerMove = (e) => {
            if (!dragging) return;
            const dx = e.clientX - prevX, dy = e.clientY - prevY;
            prevX = e.clientX;
            prevY = e.clientY;
            camAzimuth -= dx * 0.006;
            camPolar = Math.min(maxPolar, Math.max(minPolar, camPolar - dy * 0.006));
            updateCamera();
        };
        const onWheel = (e) => {
            e.preventDefault();
            camRadius = Math.min(maxRadius, Math.max(minRadius, camRadius + e.deltaY * 0.01));
            updateCamera();
        };

        const canvasEl = renderer.domElement;
        canvasEl.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointermove', onPointerMove);
        canvasEl.addEventListener('wheel', onWheel, { passive: false });

        /* ===================== LIGHTING ===================== */
        const legacyFactor = Math.PI * 1.25; // Boost slightly to fully match older lighting brightness

        scene.add(new THREE.HemisphereLight(0xcdd8e6, 0x23262a, 0.65 * legacyFactor));

        const keyLight = new THREE.DirectionalLight(0xfff2df, 1.05 * legacyFactor);
        keyLight.position.set(7, 11, 5);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(2048, 2048);
        keyLight.shadow.camera.left = -12;
        keyLight.shadow.camera.right = 12;
        keyLight.shadow.camera.top = 12;
        keyLight.shadow.camera.bottom = -12;
        keyLight.shadow.camera.near = 1;
        keyLight.shadow.camera.far = 30;
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x9fc4ff, 0.25 * legacyFactor);
        fillLight.position.set(-8, 5, -6);
        scene.add(fillLight);

        function addHangingLamp(x, z) {
            const grp = new THREE.Group();
            const rod = new THREE.Mesh(
                new THREE.CylinderGeometry(0.03, 0.03, 2.6, 8),
                new THREE.MeshStandardMaterial({ color: 0x2b2e31, metalness: 0.7, roughness: 0.5 })
            );
            rod.position.y = 6.6;
            grp.add(rod);

            const shade = new THREE.Mesh(
                new THREE.ConeGeometry(0.42, 0.4, 20, 1, true),
                new THREE.MeshStandardMaterial({ color: 0x2b2e31, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide })
            );
            shade.position.y = 5.25;
            grp.add(shade);

            const bulb = new THREE.Mesh(
                new THREE.SphereGeometry(0.16, 16, 16),
                new THREE.MeshBasicMaterial({ color: 0xffdb99 })
            );
            bulb.position.y = 5.05;
            grp.add(bulb);

            const lamp = new THREE.PointLight(0xffc879, 0.55 * legacyFactor, 14, 2);
            lamp.position.y = 5.0;
            grp.add(lamp);

            grp.position.set(x, 0, z);
            scene.add(grp);
        }
        addHangingLamp(-3.4, 2.2);
        addHangingLamp(3.6, -1.4);

        /* ===================== FLOOR ===================== */
        const floorTex = makeFloorTexture();
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(40, 40),
            new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95, metalness: 0.05 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        /* ===================== MACHINE PARAMETERS ===================== */
        const H = 2.55;                 // shaft height above floor
        const R = 1.5;                  // coil radius
        const coilWidth = 1.85;         // coil length along shaft (X axis)
        const halfW = coilWidth / 2;
        const coilCenter = new THREE.Vector3(0, H, 0);   // coil sits on the machine centerline (z = 0)
        const supportX = 1.55;          // distance from centerline to each support stand
        const FLOOR_TOP = 0.16;         // top surface of the base skids

        const steelMat = new THREE.MeshStandardMaterial({ color: 0x4d5257, metalness: 0.85, roughness: 0.45 });
        const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x33373b, metalness: 0.75, roughness: 0.55 });

        /* safety walkway painted in the floor gap between the decoiler skid and the feed-table skid */
        const hazardTex = makeHazardTexture();
        const hazardStrip = new THREE.Mesh(
            new THREE.PlaneGeometry(3.6, 0.55),
            new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.9 })
        );
        hazardStrip.rotation.x = -Math.PI / 2;
        hazardStrip.position.set(0, 0.005, 1.55);
        scene.add(hazardStrip);

        /* structural member generator */
        function makeMember(bx, by, bz, tx, ty, tz, thickness, material) {
            const bottom = new THREE.Vector3(bx, by, bz);
            const top = new THREE.Vector3(tx, ty, tz);
            const dir = new THREE.Vector3().subVectors(top, bottom);
            const length = dir.length();
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, length, thickness), material);
            mesh.position.addVectors(bottom, top).multiplyScalar(0.5);
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
            mesh.castShadow = true;
            return mesh;
        }

        /* decoiler base */
        const decoilerBaseLeft = -(supportX + 0.9);
        const decoilerBaseRight = supportX + 3.0;
        const decoilerBase = new THREE.Mesh(
            new THREE.BoxGeometry(decoilerBaseRight - decoilerBaseLeft, FLOOR_TOP, 1.6),
            darkSteelMat
        );
        decoilerBase.position.set((decoilerBaseLeft + decoilerBaseRight) / 2, FLOOR_TOP / 2, 0);
        decoilerBase.castShadow = true;
        decoilerBase.receiveShadow = true;
        scene.add(decoilerBase);

        /* feed-table skid */
        const feedBase = new THREE.Mesh(new THREE.BoxGeometry(coilWidth + 0.9, FLOOR_TOP, 2.0), darkSteelMat);
        feedBase.position.set(0, FLOOR_TOP / 2, 3.85);
        feedBase.castShadow = true;
        feedBase.receiveShadow = true;
        scene.add(feedBase);

        /* A-frame support stands */
        function buildSupport(xPos) {
            const grp = new THREE.Group();
            const legSpecs = [
                [0.68, 0.30, 0.20, H, 0.30],
                [-0.68, 0.30, -0.20, H, 0.30],
                [0.68, -0.30, 0.20, H, -0.30],
                [-0.68, -0.30, -0.20, H, -0.30]
            ];
            legSpecs.forEach(s => grp.add(makeMember(s[0], FLOOR_TOP, s[1], s[2], s[3], s[4], 0.14, steelMat)));
            grp.add(makeMember(0.68, FLOOR_TOP + 0.1, 0.30, 0.68, FLOOR_TOP + 0.1, -0.30, 0.12, steelMat));
            grp.add(makeMember(-0.68, FLOOR_TOP + 0.1, 0.30, -0.68, FLOOR_TOP + 0.1, -0.30, 0.12, steelMat));

            const bearing = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.9), darkSteelMat);
            bearing.position.set(0, H, 0);
            bearing.castShadow = true;
            grp.add(bearing);

            grp.position.set(xPos, 0, 0);
            return grp;
        }
        scene.add(buildSupport(-supportX));
        scene.add(buildSupport(supportX));

        /* Shaft */
        const shaftHalfLength = supportX + 0.35;
        const shaft = new THREE.Mesh(
            new THREE.CylinderGeometry(0.17, 0.17, shaftHalfLength * 2, 20),
            darkSteelMat
        );
        shaft.rotation.z = Math.PI / 2;
        shaft.position.set(0, H, 0);
        shaft.castShadow = true;
        scene.add(shaft);


        /* ===================== COIL ===================== */
        const coilEndTex = makeCoilEndTexture(1024);
        const coilSideTex = makeCoilSideTexture();

        const coilSideMat = new THREE.MeshStandardMaterial({ map: coilSideTex, metalness: 0.9, roughness: 0.4 });
        const coilCapMatA = new THREE.MeshStandardMaterial({ map: coilEndTex, metalness: 0.55, roughness: 0.55 });
        const coilCapMatB = new THREE.MeshStandardMaterial({ map: coilEndTex, metalness: 0.55, roughness: 0.55 });

        const coilGeo = new THREE.CylinderGeometry(R, R, coilWidth, 72, 1, false);
        const coilMesh = new THREE.Mesh(coilGeo, [coilSideMat, coilCapMatA, coilCapMatB]);
        coilMesh.castShadow = true;
        coilMesh.receiveShadow = true;

        const coilGroup = new THREE.Group();
        coilGroup.rotation.z = Math.PI / 2;
        coilGroup.position.copy(coilCenter);
        coilGroup.add(coilMesh);
        scene.add(coilGroup);

        /* Coil Stack Fencing (3 sides) */
        const fenceGroup = new THREE.Group();
        const fenceMat = new THREE.MeshStandardMaterial({ color: 0xd7a418, metalness: 0.2, roughness: 0.5 });

        const fLeft = decoilerBaseLeft - 0.2;
        const fRight = decoilerBaseRight + 0.2;
        const fZ = 1.8;
        const fBack = -1.8;
        const fH = 3.9;

        const addFencePost = (x, z) => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, fH, 12), fenceMat);
            post.position.set(x, FLOOR_TOP + fH / 2, z);
            post.castShadow = true;
            fenceGroup.add(post);
        };
        const addFenceRail = (x, z, w, d, y) => {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), fenceMat);
            rail.position.set(x, FLOOR_TOP + y, z);
            rail.castShadow = true;
            fenceGroup.add(rail);
        };

        // Posts
        [fLeft, fRight].forEach(x => {
            [fBack, fZ].forEach(z => addFencePost(x, z));
            addFencePost(x, 0);
        });
        addFencePost((fLeft + fRight) / 2, fBack);

        // Rails
        [0.6, 1.2, 1.8, 2.4, 3.0, 3.6].forEach(y => {
            addFenceRail((fLeft + fRight) / 2, fBack, fRight - fLeft, 0.04, y); // Back
            addFenceRail(fLeft, (fBack + fZ) / 2, 0.04, fZ - fBack, y);         // Left
            addFenceRail(fRight, (fBack + fZ) / 2, 0.04, fZ - fBack, y);        // Right
        });
        scene.add(fenceGroup);

        /* ===================== STRIP PATH ===================== */
        function buildStripCurve() {
            const pts = [];
            const wrapDeg = [-42, -32, -22, -14, -7, -2, 0];
            wrapDeg.forEach(d => {
                const a = THREE.MathUtils.degToRad(d);
                pts.push(new THREE.Vector3(
                    0,
                    coilCenter.y + R * Math.cos(a),
                    coilCenter.z + R * Math.sin(a)
                ));
            });
            pts.push(new THREE.Vector3(0, 3.78, 0.74));
            pts.push(new THREE.Vector3(0, 3.20, 1.48));
            pts.push(new THREE.Vector3(0, 2.62, 2.21));
            pts.push(new THREE.Vector3(0, 2.35, 3.85));
            pts.push(new THREE.Vector3(0, 2.22, 4.25));
            pts.push(new THREE.Vector3(0, 2.22, 7.6));
            return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.4);
        }
        const stripCurve = buildStripCurve();
        const maxSegments = 90;
        const spacedPoints = stripCurve.getSpacedPoints(maxSegments);
        const curveLength = stripCurve.getLength();
        const cutReachFraction = spacedPoints.findIndex(p => p.z >= 5.8) / maxSegments;
        const cutReachLength = cutReachFraction >= 0 ? curveLength * cutReachFraction : curveLength;
        const stripThickness = 0.045;

        function buildRibbonGeometry(yOffset) {
            const geo = new THREE.BufferGeometry();
            const vCount = (maxSegments + 1) * 2;
            const positions = new Float32Array(vCount * 3);
            const uvs = new Float32Array(vCount * 2);
            for (let i = 0; i <= maxSegments; i++) {
                const p = spacedPoints[i];
                const li = i * 2;
                positions[li * 3 + 0] = -halfW; positions[li * 3 + 1] = p.y + yOffset; positions[li * 3 + 2] = p.z;
                positions[(li + 1) * 3 + 0] = halfW; positions[(li + 1) * 3 + 1] = p.y + yOffset; positions[(li + 1) * 3 + 2] = p.z;
                const t = i / maxSegments;
                uvs[li * 2 + 0] = t; uvs[li * 2 + 1] = 0;
                uvs[(li + 1) * 2 + 0] = t; uvs[(li + 1) * 2 + 1] = 1;
            }
            const indices = [];
            for (let i = 0; i < maxSegments; i++) {
                const a = 2 * i, b = 2 * i + 1, cIdx = 2 * i + 2, d = 2 * i + 3;
                indices.push(a, cIdx, b, b, cIdx, d);
            }
            geo.setIndex(indices);
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            geo.computeVertexNormals();
            geo.setDrawRange(0, 0);
            return geo;
        }

        const stripTexTop = makeStripTexture();
        stripTexTop.repeat.set(curveLength / 1.1, 1);
        const stripMatTop = new THREE.MeshStandardMaterial({ map: stripTexTop, metalness: 0.75, roughness: 0.32, side: THREE.DoubleSide });

        const stripTexBottom = makeStripTexture();
        stripTexBottom.repeat.set(curveLength / 1.1, 1);
        const stripMatBottom = new THREE.MeshStandardMaterial({ map: stripTexBottom, color: 0x9aa0a4, metalness: 0.7, roughness: 0.5, side: THREE.DoubleSide });

        const ribbonTopGeo = buildRibbonGeometry(0);
        const ribbonBottomGeo = buildRibbonGeometry(-stripThickness);
        const ribbonTop = new THREE.Mesh(ribbonTopGeo, stripMatTop);
        const ribbonBottom = new THREE.Mesh(ribbonBottomGeo, stripMatBottom);
        ribbonTop.castShadow = true;
        ribbonTop.receiveShadow = true;
        ribbonBottom.receiveShadow = true;
        scene.add(ribbonTop, ribbonBottom);

        /* ===================== NC SERVO ROLL FEEDER ===================== */
        function buildServoFeeder() {
            const feederCenterZ = 3.85;
            const nipTopY = 2.35;
            const nipBottomY = nipTopY - stripThickness;
            const compScale = 1.35;
            const reachScale = 1.15;
            const rollRadius = 0.22 * compScale;
            const rollLen = coilWidth + 0.3 * compScale;
            const upperRollY = nipTopY + rollRadius;
            const lowerRollY = nipBottomY - rollRadius;
            const plateX = halfW + 0.32 * compScale;
            const cabinetTopY = lowerRollY;
            const plateTopY = upperRollY + rollRadius + 0.55 * compScale;

            const feederBlueMat = new THREE.MeshStandardMaterial({ color: 0x1c3f66, metalness: 0.5, roughness: 0.42 });
            const feederDarkMat = new THREE.MeshStandardMaterial({ color: 0x24262a, metalness: 0.6, roughness: 0.5 });
            const polishedMat = new THREE.MeshStandardMaterial({ color: 0xd9dcdf, metalness: 0.95, roughness: 0.16 });
            const boltMat = new THREE.MeshStandardMaterial({ color: 0x111214, metalness: 0.7, roughness: 0.4 });
            const panelBodyMat = new THREE.MeshStandardMaterial({ color: 0x16181b, metalness: 0.4, roughness: 0.55 });
            const screenMat = new THREE.MeshStandardMaterial({ color: 0x08222c, emissive: 0x1fb6ff, emissiveIntensity: 0.55, roughness: 0.35 });

            const grp = new THREE.Group();

            const cabinet = new THREE.Mesh(new THREE.BoxGeometry(2.6 * compScale, cabinetTopY - FLOOR_TOP, 1.0 * compScale), feederBlueMat);
            cabinet.position.set(0, (FLOOR_TOP + cabinetTopY) / 2, feederCenterZ);
            cabinet.castShadow = true; cabinet.receiveShadow = true;
            grp.add(cabinet);

            const chamferFront = new THREE.Mesh(new THREE.BoxGeometry(2.4 * compScale, 0.12 * compScale, 0.12 * compScale), feederDarkMat);
            chamferFront.rotation.x = Math.PI / 4;
            chamferFront.position.set(0, cabinetTopY - 0.02 * compScale, feederCenterZ - 0.5 * compScale);
            grp.add(chamferFront);
            const chamferBack = chamferFront.clone();
            chamferBack.position.z = feederCenterZ + 0.5 * compScale;
            grp.add(chamferBack);

            const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.75 * compScale, 0.18 * compScale, 1.15 * compScale), feederDarkMat);
            plinth.position.set(0, FLOOR_TOP + 0.09 * compScale, feederCenterZ);
            plinth.castShadow = true; plinth.receiveShadow = true;
            grp.add(plinth);

            function buildCheekPlate(sign) {
                const pg = new THREE.Group();
                const mainPlate = new THREE.Mesh(new THREE.BoxGeometry(0.14 * compScale, plateTopY - FLOOR_TOP, 1.05 * compScale), feederDarkMat);
                mainPlate.position.set(sign * plateX, (FLOOR_TOP + plateTopY) / 2, feederCenterZ);
                mainPlate.castShadow = true;
                pg.add(mainPlate);

                const topBlock = new THREE.Mesh(new THREE.BoxGeometry(0.18 * compScale, 0.5 * compScale, 0.72 * compScale), feederDarkMat);
                topBlock.position.set(sign * plateX, plateTopY - 0.25 * compScale, feederCenterZ);
                topBlock.castShadow = true;
                pg.add(topBlock);

                [lowerRollY, upperRollY].forEach(ry => {
                    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * compScale, 0.15 * compScale, 0.12 * compScale, 16), feederDarkMat);
                    boss.rotation.z = Math.PI / 2;
                    boss.position.set(sign * (plateX + 0.06 * compScale), ry, feederCenterZ);
                    boss.castShadow = true;
                    pg.add(boss);
                });

                const boltFaceX = sign * (plateX + 0.075 * compScale);
                for (let row = 0; row < 4; row++) {
                    for (let col = 0; col < 2; col++) {
                        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.032 * compScale, 0.032 * compScale, 0.02 * compScale, 6), boltMat);
                        bolt.rotation.z = Math.PI / 2;
                        bolt.position.set(boltFaceX, FLOOR_TOP + 0.35 * compScale + row * 0.55 * compScale, feederCenterZ - 0.32 * compScale + col * 0.64 * compScale);
                        pg.add(bolt);
                    }
                }
                return pg;
            }
            grp.add(buildCheekPlate(-1));
            grp.add(buildCheekPlate(1));

            const lowerRoll = new THREE.Mesh(new THREE.CylinderGeometry(rollRadius, rollRadius, rollLen, 28), polishedMat);
            lowerRoll.rotation.z = Math.PI / 2;
            lowerRoll.position.set(0, lowerRollY, feederCenterZ);
            lowerRoll.castShadow = true;
            grp.add(lowerRoll);

            const upperRoll = new THREE.Mesh(new THREE.CylinderGeometry(rollRadius, rollRadius, rollLen, 28), polishedMat);
            upperRoll.rotation.z = Math.PI / 2;
            upperRoll.position.set(0, upperRollY, feederCenterZ);
            upperRoll.castShadow = true;
            grp.add(upperRoll);

            const releaseBlock = new THREE.Mesh(new THREE.BoxGeometry(coilWidth + 0.1 * compScale, 0.18 * compScale, 0.5 * compScale), feederDarkMat);
            releaseBlock.position.set(0, upperRollY + rollRadius + 0.09 * compScale, feederCenterZ);
            releaseBlock.castShadow = true;
            grp.add(releaseBlock);

            [-1, 1].forEach(sign => {
                const gx = sign * 0.55 * compScale;
                const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * compScale, 0.045 * compScale, 0.6 * compScale, 12), polishedMat);
                rail.position.set(gx, upperRollY + rollRadius + 0.09 * compScale + 0.3 * compScale, feederCenterZ - 0.2 * compScale);
                grp.add(rail);

                const cylBody = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * compScale, 0.09 * compScale, 0.36 * compScale, 16), feederDarkMat);
                cylBody.position.set(gx, upperRollY + rollRadius + 0.09 * compScale + 0.45 * compScale, feederCenterZ + 0.18 * compScale);
                cylBody.castShadow = true;
                grp.add(cylBody);

                const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.032 * compScale, 0.032 * compScale, 0.28 * compScale, 12), polishedMat);
                piston.position.set(gx, upperRollY + rollRadius + 0.09 * compScale + 0.16 * compScale, feederCenterZ + 0.18 * compScale);
                grp.add(piston);

                const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.16 * compScale, 0.1 * compScale, 0.16 * compScale), feederDarkMat);
                bracket.position.set(gx, upperRollY + rollRadius + 0.09 * compScale, feederCenterZ + 0.18 * compScale);
                grp.add(bracket);
            });

            function buildGuide(zOff, atTop) {
                const gy = atTop ? nipTopY + 0.09 * compScale : nipBottomY - 0.09 * compScale;
                const guide = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * compScale, 0.07 * compScale, coilWidth + 0.05 * compScale, 16), polishedMat);
                guide.rotation.z = Math.PI / 2;
                guide.position.set(0, gy, feederCenterZ + zOff);
                guide.castShadow = true;
                grp.add(guide);
                [-1, 1].forEach(sign => {
                    const bkt = new THREE.Mesh(new THREE.BoxGeometry(0.1 * compScale, 0.16 * compScale, 0.1 * compScale), feederDarkMat);
                    bkt.position.set(sign * (halfW + 0.05 * compScale), gy - (atTop ? 0.08 * compScale : -0.08 * compScale), feederCenterZ + zOff);
                    grp.add(bkt);
                });
                return guide;
            }
            const guideIn = buildGuide(-0.62 * reachScale, true);
            const guideOut = buildGuide(0.62 * reachScale, false);

            const gearboxX = plateX + 0.42 * compScale;
            const gearbox = new THREE.Mesh(new THREE.BoxGeometry(0.5 * compScale, 0.48 * compScale, 0.52 * compScale), feederDarkMat);
            gearbox.position.set(gearboxX, lowerRollY, feederCenterZ);
            gearbox.castShadow = true;
            grp.add(gearbox);

            const feederCoupling = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * compScale, 0.11 * compScale, 0.16 * compScale, 16), polishedMat);
            feederCoupling.rotation.z = Math.PI / 2;
            feederCoupling.position.set(plateX + 0.16 * compScale, lowerRollY, feederCenterZ);
            grp.add(feederCoupling);

            const motorBodyX = gearboxX + 0.56 * compScale;
            const feederMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.21 * compScale, 0.21 * compScale, 0.56 * compScale, 20), feederBlueMat);
            feederMotor.rotation.z = Math.PI / 2;
            feederMotor.position.set(motorBodyX, lowerRollY, feederCenterZ);
            feederMotor.castShadow = true;
            grp.add(feederMotor);

            const endCap = new THREE.Mesh(new THREE.CylinderGeometry(0.23 * compScale, 0.23 * compScale, 0.05 * compScale, 20), feederDarkMat);
            endCap.rotation.z = Math.PI / 2;
            endCap.position.set(motorBodyX + 0.30 * compScale, lowerRollY, feederCenterZ);
            grp.add(endCap);

            const motorBracket = new THREE.Mesh(new THREE.BoxGeometry(0.14 * compScale, lowerRollY - FLOOR_TOP, 0.14 * compScale), feederDarkMat);
            motorBracket.position.set(gearboxX, (FLOOR_TOP + lowerRollY) / 2, feederCenterZ - 0.22 * compScale);
            grp.add(motorBracket);

            const panelX = -(plateX + 0.09 * compScale);
            const panel = new THREE.Mesh(new THREE.BoxGeometry(0.05 * compScale, 0.42 * compScale, 0.32 * compScale), panelBodyMat);
            panel.position.set(panelX, FLOOR_TOP + 1.05 * compScale, feederCenterZ);
            panel.castShadow = true;
            grp.add(panel);

            const screen = new THREE.Mesh(new THREE.BoxGeometry(0.02 * compScale, 0.16 * compScale, 0.2 * compScale), screenMat);
            screen.position.set(panelX - 0.035 * compScale, FLOOR_TOP + 1.16 * compScale, feederCenterZ);
            grp.add(screen);

            [0x35d15a, 0xffb400, 0xe4392f].forEach((col, i) => {
                const lamp = new THREE.Mesh(
                    new THREE.SphereGeometry(0.025 * compScale, 10, 10),
                    new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.8 })
                );
                lamp.position.set(panelX - 0.035 * compScale, FLOOR_TOP + 1.32 * compScale, feederCenterZ - 0.1 * compScale + i * 0.1 * compScale);
                grp.add(lamp);
            });

            [0x2fa84f, 0xcf2a24, 0x1c1e20, 0x1c1e20].forEach((col, i) => {
                const btn = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.026 * compScale, 0.026 * compScale, 0.02 * compScale, 12),
                    new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 })
                );
                btn.rotation.z = Math.PI / 2;
                btn.position.set(panelX - 0.035 * compScale, FLOOR_TOP + 0.92 * compScale, feederCenterZ - 0.1 * compScale + i * 0.07 * compScale);
                grp.add(btn);
            });

            const eStopStem = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * compScale, 0.03 * compScale, 0.05 * compScale, 12), new THREE.MeshStandardMaterial({ color: 0xb01e1e }));
            eStopStem.rotation.z = Math.PI / 2;
            eStopStem.position.set(panelX - 0.05 * compScale, FLOOR_TOP + 0.82 * compScale, feederCenterZ + 0.11 * compScale);
            grp.add(eStopStem);
            const eStopCap = new THREE.Mesh(new THREE.SphereGeometry(0.05 * compScale, 14, 14), new THREE.MeshStandardMaterial({ color: 0xd42020, roughness: 0.35 }));
            eStopCap.position.set(panelX - 0.08 * compScale, FLOOR_TOP + 0.82 * compScale, feederCenterZ + 0.11 * compScale);
            grp.add(eStopCap);

            const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * compScale, 0.025 * compScale, 0.6 * compScale, 10), feederDarkMat);
            conduit.position.set(panelX, FLOOR_TOP + 0.5 * compScale, feederCenterZ + 0.14 * compScale);
            grp.add(conduit);

            return { grp, lowerRoll, upperRoll, feederCoupling, feederMotor, guideIn, guideOut, rollRadius };
        }
        const servoFeeder = buildServoFeeder();
        scene.add(servoFeeder.grp);

        /* ===================== CUT-TO-LENGTH MACHINE ===================== */
        function buildCutToLengthMachine() {
            const cutZ = 5.8;
            const stripTopY = 2.22;
            const stripBottomY = stripTopY - stripThickness;
            const compScale = 1.35;
            const reachScale = 1.15;
            const frameZmin = cutZ - 0.4 * reachScale, frameZmax = cutZ + 1.6 * reachScale;
            const columnX = 1.15 * compScale;
            const bedTopY = stripBottomY - 0.05 * compScale;

            const ctlDarkMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.6, roughness: 0.5 });
            const ctlBodyMat = new THREE.MeshStandardMaterial({ color: 0x33373b, metalness: 0.55, roughness: 0.48 });
            const ctlYellowMat = new THREE.MeshStandardMaterial({ color: 0xd7a418, metalness: 0.3, roughness: 0.55 });
            const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe7eaec, metalness: 0.9, roughness: 0.2 });
            const anvilMat = new THREE.MeshStandardMaterial({ color: 0xb7bcc0, metalness: 0.85, roughness: 0.3 });
            const pieceMat = new THREE.MeshStandardMaterial({ color: 0xd6dade, metalness: 0.7, roughness: 0.32, side: THREE.DoubleSide });

            const frontPanelPieceMat = pieceMat.clone();
            const fanCanvas = document.createElement('canvas');
            fanCanvas.width = 512; fanCanvas.height = 512;
            const ctx = fanCanvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; // Opaque part
            ctx.fillRect(0, 0, 512, 512);
            ctx.beginPath();
            // Hole off-center (X=0.15 in 3D -> U=0.65 -> U=332) and radius 0.22 -> 112
            ctx.arc(332, 256, 112, 0, Math.PI * 2);
            ctx.fillStyle = '#000000'; // Transparent part
            ctx.fill();
            const alphaTex = new THREE.CanvasTexture(fanCanvas);
            frontPanelPieceMat.transparent = true;
            frontPanelPieceMat.alphaMap = alphaTex;
            frontPanelPieceMat.alphaTest = 0.5;

            const grp = new THREE.Group();

            const skid = new THREE.Mesh(new THREE.BoxGeometry(2.7 * compScale, FLOOR_TOP, (frameZmax - frameZmin) + 0.6 * compScale), ctlDarkMat);
            skid.position.set(0, FLOOR_TOP / 2, (frameZmin + frameZmax) / 2);
            skid.castShadow = true; skid.receiveShadow = true;
            grp.add(skid);

            const bed = new THREE.Mesh(new THREE.BoxGeometry(2.6 * compScale, bedTopY - FLOOR_TOP, frameZmax - frameZmin), ctlBodyMat);
            bed.position.set(0, (FLOOR_TOP + bedTopY) / 2, (frameZmin + frameZmax) / 2);
            bed.castShadow = true; bed.receiveShadow = true;
            grp.add(bed);

            const entryTable = new THREE.Mesh(new THREE.BoxGeometry(coilWidth + 0.3, 0.06, 0.55), ctlBodyMat);
            entryTable.position.set(0, stripBottomY - 0.03, 5.075);
            entryTable.castShadow = true; entryTable.receiveShadow = true;
            grp.add(entryTable);

            const exitTable = new THREE.Mesh(new THREE.BoxGeometry(coilWidth + 0.3, 0.06, 1.6), ctlBodyMat);
            exitTable.position.set(0, stripBottomY - 0.03, 6.7);
            exitTable.castShadow = true; exitTable.receiveShadow = true;
            grp.add(exitTable);

            const columnTopY = stripTopY + 1.05 * compScale;
            [-1, 1].forEach(sign => {
                const col = new THREE.Mesh(new THREE.BoxGeometry(0.26 * compScale, columnTopY - FLOOR_TOP, 0.5 * compScale), ctlDarkMat);
                col.position.set(sign * columnX, (FLOOR_TOP + columnTopY) / 2, cutZ);
                col.castShadow = true; col.receiveShadow = true;
                grp.add(col);

                const trim = new THREE.Mesh(new THREE.BoxGeometry(0.28 * compScale, 0.1 * compScale, 0.52 * compScale), ctlYellowMat);
                trim.position.set(sign * columnX, bedTopY + 0.05 * compScale, cutZ);
                grp.add(trim);
            });

            const crossMember = new THREE.Mesh(new THREE.BoxGeometry(2.6 * compScale, 0.3 * compScale, 0.5 * compScale), ctlDarkMat);
            crossMember.position.set(0, columnTopY - 0.15 * compScale, cutZ);
            crossMember.castShadow = true;
            grp.add(crossMember);

            const anvil = new THREE.Mesh(new THREE.BoxGeometry(coilWidth + 0.15 * compScale, 0.05 * compScale, 0.16 * compScale), anvilMat);
            anvil.position.set(0, stripBottomY - 0.03 * compScale, cutZ);
            anvil.castShadow = true;
            grp.add(anvil);

            const bladeLocalDrop = 0.16 * compScale;
            const holderTravelTop = stripTopY + 0.4 * compScale + bladeLocalDrop;
            const holderTravelBottom = stripBottomY - 0.02 * compScale + bladeLocalDrop;

            const bladeHolder = new THREE.Mesh(new THREE.BoxGeometry(1.86 * compScale, 0.22 * compScale, 0.3 * compScale), ctlDarkMat);
            bladeHolder.castShadow = true;
            bladeHolder.position.set(0, holderTravelTop, cutZ);
            grp.add(bladeHolder);

            const blade = new THREE.Mesh(new THREE.BoxGeometry(coilWidth + 0.07 * compScale, 0.14 * compScale, 0.05 * compScale), bladeMat);
            blade.rotation.z = THREE.MathUtils.degToRad(3);
            blade.position.set(0, -bladeLocalDrop, 0);
            blade.castShadow = true;
            bladeHolder.add(blade);

            const railTopY = columnTopY - 0.2 * compScale, railBottomY = bedTopY + 0.1 * compScale;
            [-1, 1].forEach(sign => {
                const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * compScale, 0.035 * compScale, railTopY - railBottomY, 10), anvilMat);
                rail.position.set(sign * 0.99 * compScale, (railTopY + railBottomY) / 2, cutZ);
                grp.add(rail);
            });

            const pieceCenterY = stripBottomY + stripThickness / 2;
            const cutLength = 1.3;
            const exitLimitZ = 7.5;
            const pieces = [];
            for (let i = 0; i < 250; i++) {
                // Increase resolution to 80x80 so circular fan stamps render smoothly
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(coilWidth, stripThickness, 1, 80, 1, 80), pieceMat);
                mesh.castShadow = true; mesh.receiveShadow = true;
                mesh.userData.formBasePositions = mesh.geometry.attributes.position.array.slice();
                mesh.visible = false;
                mesh.scale.z = 0.001;
                mesh.position.set(0, pieceCenterY, cutZ);
                grp.add(mesh);
                pieces.push(mesh);
            }

            return {
                grp, blade, bladeHolder, cutZ, stripTopY, stripBottomY,
                holderTravelTop, holderTravelBottom, pieces,
                cutLength, pieceCenterY, exitLimitZ, pieceMat, frontPanelPieceMat
            };
        }
        const cutToLength = buildCutToLengthMachine();
        scene.add(cutToLength.grp);

        const stripCutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), cutToLength.cutZ);
        stripMatTop.clippingPlanes = [stripCutPlane];
        stripMatBottom.clippingPlanes = [stripCutPlane];

        /* ===================== STAMPING PRESS ===================== */
        const stampingCenterZ = cutToLength.exitLimitZ + 3.2;
        const stampingMaterialY = cutToLength.stripBottomY;
        const stampingMaterialTopY = cutToLength.stripTopY;

        const stampingColumnX = 1.58;
        const stampingRightSideExtension = 0.50;
        const stampingRightColumnX = stampingColumnX + stampingRightSideExtension;
        const stampingFrameCenterX = stampingRightSideExtension / 2;
        const stampingColumnW = 0.36;
        const stampingColumnD = 0.56;
        const stampingColumnTopY = 3.90;
        const stampingCrownHeight = 0.72;
        const stampingCrownTopY = stampingColumnTopY + stampingCrownHeight;
        const stampingCrownWidth = 3.46;
        const stampingCrownDepth = 3.20;

        const stampingBaseWidth = 3.52;
        const stampingBaseDepth = 3.30;
        const stampingBedWidth = 3.27;
        const stampingBedDepth = 3.05;
        const stampingBedTopY = 1.80;
        const stampingBolsterH = 0.17;
        const stampingBolsterTopY = stampingBedTopY + stampingBolsterH;
        const stampingBolsterW = 2.40;
        const stampingBolsterD = 1.90;

        const stampingLowerDieShoeH = 0.11;
        const stampingLowerDieShoeTopY = stampingBolsterTopY + stampingLowerDieShoeH;
        const stampingDieBlockH = stampingMaterialY - stampingLowerDieShoeTopY;
        const stampingDieW = coilWidth;
        const stampingDieD = cutToLength.cutLength;
        const lowerDieW = stampingDieW + 0.30;
        const lowerDieD = stampingDieD + 0.30;

        const stampingIdleGap = 0.18;
        const stampingUpperDieBlockH = 0.09;
        const stampingUpperDieShoeH = 0.11;
        const stampingRamH = 0.32;
        const stampingRamW = 1.90;
        const stampingRamD = 1.90;

        const stampingRamDownY = stampingMaterialTopY + stampingUpperDieBlockH + stampingUpperDieShoeH + stampingRamH / 2;
        const stampingRamIdleY = stampingColumnTopY - stampingIdleGap - stampingRamH / 2;

        const stampingDarkMat = new THREE.MeshStandardMaterial({ color: 0x222528, metalness: 0.72, roughness: 0.50 });
        const stampingBodyMat = new THREE.MeshStandardMaterial({ color: 0x31363b, metalness: 0.60, roughness: 0.44 });
        const stampingYellowMat = new THREE.MeshStandardMaterial({ color: 0xd7a418, metalness: 0.35, roughness: 0.52 });
        const stampingDieMat = new THREE.MeshStandardMaterial({ color: 0x82888e, metalness: 0.88, roughness: 0.28 });
        const stampingPolishedMat = new THREE.MeshStandardMaterial({ color: 0xe2e6ea, metalness: 0.96, roughness: 0.14 });
        const stampingBronzeMat = new THREE.MeshStandardMaterial({ color: 0xab7a3e, metalness: 0.80, roughness: 0.32 });
        const stampingBlackMat = new THREE.MeshStandardMaterial({ color: 0x141618, metalness: 0.45, roughness: 0.62 });
        const stampingWarningMat = new THREE.MeshStandardMaterial({ color: 0xc9362b, metalness: 0.30, roughness: 0.45 });

        const sensorLensRef = { current: null };

        function buildStampingPress() {
            const grp = new THREE.Group();

            const skid = new THREE.Mesh(new THREE.BoxGeometry(stampingBaseWidth + stampingRightSideExtension, FLOOR_TOP, stampingBaseDepth), stampingDarkMat);
            skid.position.set(stampingFrameCenterX, FLOOR_TOP / 2, stampingCenterZ);
            skid.castShadow = true; skid.receiveShadow = true;
            grp.add(skid);

            [-1, 1].forEach(sx => {
                [-1, 1].forEach(sz => {
                    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.13, 0.25), stampingDarkMat);
                    foot.position.set((sx === 1 ? stampingRightColumnX + stampingColumnW / 2 : -stampingColumnX) - sx * 0.18, FLOOR_TOP + 0.065, stampingCenterZ + sz * (stampingBaseDepth / 2 - 0.14));
                    foot.castShadow = true;
                    grp.add(foot);

                    const anchorBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.07, 6), stampingPolishedMat);
                    anchorBolt.position.set((sx === 1 ? stampingRightColumnX + stampingColumnW / 2 : -stampingColumnX) - sx * 0.18, FLOOR_TOP + 0.14, stampingCenterZ + sz * (stampingBaseDepth / 2 - 0.14));
                    grp.add(anchorBolt);
                });
            });

            const bed = new THREE.Mesh(new THREE.BoxGeometry(stampingBedWidth + stampingRightSideExtension, stampingBedTopY - FLOOR_TOP, stampingBedDepth), stampingBodyMat);
            bed.position.set(stampingFrameCenterX, (FLOOR_TOP + stampingBedTopY) / 2, stampingCenterZ);
            bed.castShadow = true; bed.receiveShadow = true;
            grp.add(bed);

            [-1, 1].forEach(sign => {
                const chuteFrame = new THREE.Mesh(new THREE.BoxGeometry(0.87, 0.31, 0.05), stampingDarkMat);
                chuteFrame.position.set(0, FLOOR_TOP + 0.31, stampingCenterZ + sign * (stampingBedDepth / 2 + 0.02));
                chuteFrame.castShadow = true;
                grp.add(chuteFrame);

                const chuteCavity = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.22, 0.07), stampingBlackMat);
                chuteCavity.position.set(0, FLOOR_TOP + 0.31, stampingCenterZ + sign * (stampingBedDepth / 2 + 0.01));
                grp.add(chuteCavity);
            });

            const bedSafetyTrim = new THREE.Mesh(new THREE.BoxGeometry(stampingBedWidth + stampingRightSideExtension + 0.06, 0.08, stampingBedDepth + 0.06), stampingYellowMat);
            bedSafetyTrim.position.set(stampingFrameCenterX, stampingBedTopY - 0.04, stampingCenterZ);
            bedSafetyTrim.castShadow = true;
            grp.add(bedSafetyTrim);

            const bolster = new THREE.Mesh(new THREE.BoxGeometry(stampingBolsterW, stampingBolsterH, stampingBolsterD), stampingDieMat);
            bolster.position.set(0, stampingBedTopY + stampingBolsterH / 2, stampingCenterZ);
            bolster.castShadow = true; bolster.receiveShadow = true;
            grp.add(bolster);

            [-0.36, 0, 0.36].forEach(zOff => {
                const tSlot = new THREE.Mesh(new THREE.BoxGeometry(stampingBolsterW + 0.002, 0.02, 0.025), stampingBlackMat);
                tSlot.position.set(0, stampingBolsterTopY - 0.01, stampingCenterZ + zOff);
                grp.add(tSlot);
            });
            [-0.40, 0.40].forEach(xOff => {
                const crossSlot = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, stampingBolsterD + 0.002), stampingBlackMat);
                crossSlot.position.set(xOff, stampingBolsterTopY - 0.01, stampingCenterZ);
                grp.add(crossSlot);
            });

            [-1, 1].forEach(sx => {
                [-1, 1].forEach(sz => {
                    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.13), stampingDarkMat);
                    clamp.position.set(sx * (stampingBolsterW / 2 + 0.04), stampingBedTopY + 0.04, stampingCenterZ + sz * 0.41);
                    clamp.castShadow = true;
                    grp.add(clamp);

                    const clampBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.09, 6), stampingPolishedMat);
                    clampBolt.position.set(sx * (stampingBolsterW / 2 + 0.04), stampingBedTopY + 0.09, stampingCenterZ + sz * 0.41);
                    grp.add(clampBolt);
                });
            });

            const lowerDieShoe = new THREE.Mesh(new THREE.BoxGeometry(lowerDieW, stampingLowerDieShoeH, lowerDieD), stampingDieMat);
            lowerDieShoe.position.set(0, stampingBolsterTopY + stampingLowerDieShoeH / 2, stampingCenterZ);
            lowerDieShoe.castShadow = true; lowerDieShoe.receiveShadow = true;
            grp.add(lowerDieShoe);

            const dieGroupBack = new THREE.Group();
            const dieGroupFront = new THREE.Group();
            const dieGroupSide = new THREE.Group();

            const buildDieCavity = (type) => {
                const cavityGrp = new THREE.Group();

                let cavW = lowerDieW - 0.34;
                let cavD = lowerDieD - 0.46;
                let cavDepth = 0.055;
                if (type === 'front_panel_ac') {
                    cavW = lowerDieW - 0.5;
                    cavD = lowerDieD - 0.2;
                    cavDepth = 0.085;
                } else if (type === 'side_panel_ac') {
                    cavW = lowerDieW - 0.2;
                    cavD = lowerDieD - 0.7;
                    cavDepth = 0.045;
                }
                const tFloorY = stampingMaterialY - cavDepth;

                const lBlock = new THREE.Mesh(
                    new THREE.BoxGeometry(lowerDieW - 0.12, stampingDieBlockH, lowerDieD - 0.10),
                    stampingDieMat
                );
                lBlock.position.set(0, stampingLowerDieShoeTopY + stampingDieBlockH / 2, stampingCenterZ);
                lBlock.castShadow = true; lBlock.receiveShadow = true;
                cavityGrp.add(lBlock);

                const tFloor = new THREE.Mesh(
                    new THREE.BoxGeometry(cavW, 0.018, cavD),
                    stampingBlackMat
                );
                tFloor.position.set(0, tFloorY + 0.009, stampingCenterZ);
                cavityGrp.add(tFloor);

                const tLandH = cavDepth;
                const landW = (lowerDieW - 0.12 - cavW) / 2;
                const landD = (lowerDieD - 0.10 - cavD) / 2;

                const leftLand = new THREE.Mesh(
                    new THREE.BoxGeometry(landW, tLandH, lowerDieD - 0.10),
                    stampingDieMat
                );
                leftLand.position.set(-(cavW / 2 + landW / 2), tFloorY + tLandH / 2, stampingCenterZ);
                leftLand.castShadow = true; leftLand.receiveShadow = true;
                cavityGrp.add(leftLand);

                const rightLand = leftLand.clone();
                rightLand.position.x = -leftLand.position.x;
                cavityGrp.add(rightLand);

                const frontLand = new THREE.Mesh(
                    new THREE.BoxGeometry(cavW, tLandH, landD),
                    stampingDieMat
                );
                frontLand.position.set(0, tFloorY + tLandH / 2, stampingCenterZ - (cavD / 2 + landD / 2));
                frontLand.castShadow = true; frontLand.receiveShadow = true;
                cavityGrp.add(frontLand);

                const rearLand = frontLand.clone();
                rearLand.position.z = stampingCenterZ + (cavD / 2 + landD / 2);
                cavityGrp.add(rearLand);

                const slopeH = cavDepth;
                const slopeT = 0.055;
                const slopeMat = stampingPolishedMat;
                [
                    { w: cavW, d: slopeT, x: 0, z: stampingCenterZ - cavD / 2 - slopeT / 2 },
                    { w: cavW, d: slopeT, x: 0, z: stampingCenterZ + cavD / 2 + slopeT / 2 },
                    { w: slopeT, d: cavD, x: -cavW / 2 - slopeT / 2, z: stampingCenterZ },
                    { w: slopeT, d: cavD, x: cavW / 2 + slopeT / 2, z: stampingCenterZ }
                ].forEach(face => {
                    const wall = new THREE.Mesh(new THREE.BoxGeometry(face.w, slopeH, face.d), slopeMat);
                    wall.position.set(face.x, tFloorY + slopeH / 2, face.z);
                    wall.rotation.z = face.x === 0 ? 0 : (face.x < 0 ? -0.12 : 0.12);
                    wall.rotation.x = face.x === 0 ? (face.z < stampingCenterZ ? -0.12 : 0.12) : 0;
                    wall.castShadow = true;
                    cavityGrp.add(wall);
                });
                return cavityGrp;
            };

            dieGroupBack.add(buildDieCavity('back_panel'));
            dieGroupFront.add(buildDieCavity('front_panel_ac'));
            dieGroupSide.add(buildDieCavity('side_panel_ac'));

            grp.add(dieGroupBack);
            grp.add(dieGroupFront);
            grp.add(dieGroupSide);

            [-(lowerDieW / 2 + 0.06), (lowerDieW / 2 + 0.06)].forEach(px => {
                [-(lowerDieD / 2 + 0.05), (lowerDieD / 2 + 0.05)].forEach(pz => {
                    const pillarFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.03, 16), stampingDarkMat);
                    pillarFlange.position.set(px, stampingLowerDieShoeTopY + 0.015, stampingCenterZ + pz);
                    grp.add(pillarFlange);

                    const leaderPin = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.36, 20), stampingPolishedMat);
                    leaderPin.position.set(px, stampingLowerDieShoeTopY + 0.18, stampingCenterZ + pz);
                    leaderPin.castShadow = true;
                    grp.add(leaderPin);
                });
            });

            [-1, 1].forEach(sign => {
                const stockGuide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, lowerDieD * 0.36), stampingBronzeMat);
                stockGuide.position.set(sign * (halfW + 0.025), stampingMaterialY + 0.012, stampingCenterZ);
                stockGuide.castShadow = true;
                grp.add(stockGuide);
            });

            [-1, 1].forEach(signX => {
                [-1, 1].forEach(signZ => {
                    const colX = (signX === 1) ? stampingRightColumnX : -stampingColumnX;
                    const colZ = stampingCenterZ + signZ * (stampingCrownDepth / 2 - stampingColumnD / 2 - 0.10);

                    const column = new THREE.Mesh(new THREE.BoxGeometry(stampingColumnW, stampingColumnTopY - FLOOR_TOP, stampingColumnD), stampingDarkMat);
                    column.position.set(colX, (FLOOR_TOP + stampingColumnTopY) / 2, colZ);
                    column.castShadow = true; column.receiveShadow = true;
                    grp.add(column);

                    const facePlate = new THREE.Mesh(new THREE.BoxGeometry(stampingColumnW + 0.04, stampingColumnTopY - FLOOR_TOP, 0.04), stampingBodyMat);
                    facePlate.position.set(colX, (FLOOR_TOP + stampingColumnTopY) / 2, colZ + signZ * (stampingColumnD / 2 + 0.03));
                    facePlate.castShadow = true;
                    grp.add(facePlate);

                    const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.25, 0.025), stampingDarkMat);
                    hatch.position.set(colX, FLOOR_TOP + 1.10, colZ + signZ * (stampingColumnD / 2 + 0.04));
                    grp.add(hatch);

                    const footFlare = new THREE.Mesh(new THREE.BoxGeometry(stampingColumnW + 0.10, 0.22, stampingColumnD + 0.09), stampingBodyMat);
                    footFlare.position.set(colX, FLOOR_TOP + 0.11, colZ);
                    footFlare.castShadow = true;
                    grp.add(footFlare);

                    const midGusset = new THREE.Mesh(new THREE.BoxGeometry(stampingColumnW + 0.05, 0.31, stampingColumnD + 0.04), stampingBodyMat);
                    midGusset.position.set(colX, stampingBedTopY + 0.16, colZ);
                    midGusset.castShadow = true;
                    grp.add(midGusset);

                    const gibInnerX = colX - signX * (stampingColumnW / 2 - 0.03);
                    const gibH = stampingColumnTopY - stampingBedTopY - 0.15;
                    const gibWay = new THREE.Mesh(new THREE.BoxGeometry(0.04, gibH, 0.09), stampingBronzeMat);
                    gibWay.position.set(gibInnerX, stampingBedTopY + 0.08 + gibH / 2, colZ);
                    gibWay.castShadow = true;
                    grp.add(gibWay);

                    for (let b = 0; b < 3; b++) {
                        const adjBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.045, 6), stampingPolishedMat);
                        adjBolt.rotation.z = Math.PI / 2;
                        adjBolt.position.set(colX + signX * (stampingColumnW / 2 + 0.02), stampingBedTopY + 0.28 + b * 0.38, colZ);
                        grp.add(adjBolt);
                    }
                });
            });

            const crown = new THREE.Mesh(new THREE.BoxGeometry(stampingCrownWidth + stampingRightSideExtension, stampingCrownHeight, stampingCrownDepth), stampingDarkMat);
            crown.position.set(stampingFrameCenterX, (stampingColumnTopY + stampingCrownTopY) / 2, stampingCenterZ);
            crown.castShadow = true; crown.receiveShadow = true;
            grp.add(crown);

            const crownFrontTrim = new THREE.Mesh(new THREE.BoxGeometry(stampingCrownWidth + stampingRightSideExtension + 0.02, 0.19, 0.05), stampingYellowMat);
            crownFrontTrim.position.set(stampingFrameCenterX, stampingCrownTopY - 0.16, stampingCenterZ - stampingCrownDepth / 2 - 0.025);
            crownFrontTrim.castShadow = true;
            grp.add(crownFrontTrim);

            const alertGroup = new THREE.Group();
            alertGroup.position.set(stampingFrameCenterX, (stampingColumnTopY + stampingCrownTopY) / 2, stampingCenterZ);
            const alertTex = makeAlertTexture();

            // LED Matrix Material
            const alertMat = new THREE.MeshStandardMaterial({
                map: alertTex,
                emissiveMap: alertTex,
                emissive: 0xffffff,
                emissiveIntensity: 1.2,
                roughness: 0.8,
                metalness: 0.1
            });

            const panelH = 0.28;
            const zOffset = stampingCrownDepth / 2 + 0.02;
            const xOffset = (stampingCrownWidth + stampingRightSideExtension) / 2 + 0.02;

            // Front & Back panels
            const fbPanelGeo = new THREE.PlaneGeometry(stampingCrownWidth + stampingRightSideExtension - 0.2, panelH);
            const frontPanel = new THREE.Mesh(fbPanelGeo, alertMat);
            frontPanel.position.set(0, 0, zOffset);

            const backPanel = new THREE.Mesh(fbPanelGeo, alertMat);
            backPanel.position.set(0, 0, -zOffset);
            backPanel.rotation.y = Math.PI;

            // Left & Right panels
            const lrPanelGeo = new THREE.PlaneGeometry(stampingCrownDepth - 0.2, panelH);
            const leftPanel = new THREE.Mesh(lrPanelGeo, alertMat);
            leftPanel.position.set(-xOffset, 0, 0);
            leftPanel.rotation.y = -Math.PI / 2;

            const rightPanel = new THREE.Mesh(lrPanelGeo, alertMat);
            rightPanel.position.set(xOffset, 0, 0);
            rightPanel.rotation.y = Math.PI / 2;

            alertGroup.add(frontPanel, backPanel, leftPanel, rightPanel);
            alertGroup.visible = false;
            grp.add(alertGroup);

            [-1, 1].forEach(sx => {
                [-1, 1].forEach(sz => {
                    const nutX = (sx === 1) ? stampingRightColumnX : -stampingColumnX;
                    const nutZ = stampingCenterZ + sz * 0.82;

                    const tieNut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.11, 8), stampingDarkMat);
                    tieNut.position.set(nutX, stampingCrownTopY + 0.06, nutZ);
                    tieNut.castShadow = true;
                    grp.add(tieNut);

                    const tieStud = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 16), stampingPolishedMat);
                    tieStud.position.set(nutX, stampingCrownTopY + 0.14, nutZ);
                    grp.add(tieStud);
                });
            });

            const crankHousing = new THREE.Mesh(new THREE.BoxGeometry(0.81, 0.39, 0.68), stampingBodyMat);
            crankHousing.position.set(0, stampingCrownTopY + 0.195, stampingCenterZ);
            crankHousing.castShadow = true;
            grp.add(crankHousing);

            const crankInspectionHatch = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 16), stampingDarkMat);
            crankInspectionHatch.position.set(0, stampingCrownTopY + 0.40, stampingCenterZ);
            grp.add(crankInspectionHatch);

            const motorBracket = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.08, 0.41), stampingDarkMat);
            motorBracket.position.set(-0.46, stampingCrownTopY - 0.06, stampingCenterZ + stampingCrownDepth / 2 + 0.19);
            motorBracket.castShadow = true;
            grp.add(motorBracket);

            const mainMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.46, 20), stampingBodyMat);
            mainMotor.rotation.z = Math.PI / 2;
            mainMotor.position.set(-0.46, stampingCrownTopY + 0.12, stampingCenterZ + stampingCrownDepth / 2 + 0.19);
            mainMotor.castShadow = true;
            grp.add(mainMotor);

            const motorFanCover = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.07, 20), stampingDarkMat);
            motorFanCover.rotation.z = Math.PI / 2;
            motorFanCover.position.set(-0.20, stampingCrownTopY + 0.12, stampingCenterZ + stampingCrownDepth / 2 + 0.19);
            grp.add(motorFanCover);

            const motorJunctionBox = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.10, 0.10), stampingDarkMat);
            motorJunctionBox.position.set(-0.46, stampingCrownTopY + 0.26, stampingCenterZ + stampingCrownDepth / 2 + 0.19);
            grp.add(motorJunctionBox);

            const flywheelX = -stampingCrownWidth / 2 - 0.09;
            const flywheelY = stampingCrownTopY - 0.07;
            const flywheelZ = stampingCenterZ + 0.18;
            const flywheelRadius = 0.41;

            const driveShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.36, 20), stampingPolishedMat);
            driveShaft.rotation.z = Math.PI / 2;
            driveShaft.position.set(flywheelX + 0.15, flywheelY, flywheelZ);
            grp.add(driveShaft);

            const clutchHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.15, 24), stampingDarkMat);
            clutchHousing.rotation.z = Math.PI / 2;
            clutchHousing.position.set(flywheelX + 0.11, flywheelY, flywheelZ);
            clutchHousing.castShadow = true;
            grp.add(clutchHousing);

            const flywheelRim = new THREE.Mesh(new THREE.TorusGeometry(flywheelRadius - 0.06, 0.06, 16, 36), stampingDarkMat);
            flywheelRim.rotation.y = Math.PI / 2;
            flywheelRim.position.set(flywheelX, flywheelY, flywheelZ);
            flywheelRim.castShadow = true;
            grp.add(flywheelRim);

            const flywheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.10, 20), stampingPolishedMat);
            flywheelHub.rotation.z = Math.PI / 2;
            flywheelHub.position.set(flywheelX, flywheelY, flywheelZ);
            grp.add(flywheelHub);

            for (let s = 0; s < 6; s++) {
                const angle = s * (Math.PI / 3);
                const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.045, flywheelRadius * 1.6, 0.04), stampingBodyMat);
                spoke.rotation.x = angle;
                spoke.position.set(flywheelX, flywheelY, flywheelZ);
                grp.add(spoke);
            }

            const guardFrame = new THREE.Mesh(new THREE.BoxGeometry(0.15, flywheelRadius * 2 + 0.13, flywheelRadius * 2 + 0.13), stampingYellowMat);
            guardFrame.position.set(flywheelX, flywheelY, flywheelZ);
            grp.add(guardFrame);

            const guardMeshPlate = new THREE.Mesh(new THREE.BoxGeometry(0.015, flywheelRadius * 2 + 0.10, flywheelRadius * 2 + 0.10), stampingDarkMat);
            guardMeshPlate.position.set(flywheelX - 0.08, flywheelY, flywheelZ);
            grp.add(guardMeshPlate);

            const beltGuard = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.30, 0.52), stampingDarkMat);
            beltGuard.position.set(flywheelX + 0.22, flywheelY + 0.06, stampingCenterZ + 1.10);
            beltGuard.castShadow = true;
            grp.add(beltGuard);

            [-0.85, 0.85].forEach(dz => {
                const cx = -stampingColumnX;
                const cz = stampingCenterZ + dz;
                const cylBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.39, 0.5), stampingBodyMat);
                cylBody.position.set(cx, stampingCrownTopY + 0.195, cz);
                cylBody.castShadow = true;
                grp.add(cylBody);

                const cylHatch = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 16), stampingDarkMat);
                cylHatch.position.set(cx, stampingCrownTopY + 0.40, cz);
                grp.add(cylHatch);
            });

            const stampingRamGroup = new THREE.Group();
            stampingRamGroup.position.set(0, stampingRamIdleY, stampingCenterZ);

            const ramBody = new THREE.Mesh(new THREE.BoxGeometry(stampingRamW, stampingRamH, stampingRamD), stampingBodyMat);
            ramBody.castShadow = true; ramBody.receiveShadow = true;
            stampingRamGroup.add(ramBody);

            const ramSupportMembers = [];
            const support = new THREE.Mesh(
                new THREE.BoxGeometry(stampingRamW, 1, stampingRamD),
                stampingPolishedMat
            );
            support.position.set(0, stampingRamH / 2 + 0.28, 0);
            support.castShadow = true;
            stampingRamGroup.add(support);
            ramSupportMembers.push(support);

            [-0.65, 0, 0.65].forEach(rx => {
                const ramRib = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, stampingRamD - 0.06), stampingDarkMat);
                ramRib.position.set(rx, stampingRamH / 2 + 0.05, 0);
                ramRib.castShadow = true;
                stampingRamGroup.add(ramRib);
            });

            [-1, 1].forEach(rxSign => {
                [-1, 1].forEach(rzSign => {
                    const gibShoe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.13), stampingBronzeMat);
                    gibShoe.position.set(rxSign * (stampingRamW / 2 + 0.02), 0, rzSign * 0.66);
                    gibShoe.castShadow = true;
                    stampingRamGroup.add(gibShoe);
                });
            });

            const pitmanRods = [];
            [-0.68, 0.68].forEach(px => {
                const pitman = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.55, 16), stampingDarkMat);
                pitman.position.set(px, stampingRamH / 2 + 0.28, 0);
                pitman.castShadow = true;
                stampingRamGroup.add(pitman);
                pitmanRods.push(pitman);

                const wristPin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.11, 16), stampingPolishedMat);
                wristPin.rotation.x = Math.PI / 2;
                wristPin.position.set(px, stampingRamH / 2 + 0.06, 0);
                stampingRamGroup.add(wristPin);
            });

            const pistonRods = [];
            [-0.74, 0.74].forEach(cx => {
                const pistonRod = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.55, 16), stampingPolishedMat);
                pistonRod.position.set(cx, stampingRamH / 2 + 0.28, 0);
                stampingRamGroup.add(pistonRod);
                pistonRods.push(pistonRod);
            });

            const upperDieShoe = new THREE.Mesh(new THREE.BoxGeometry(stampingDieW, stampingUpperDieShoeH, stampingDieD), stampingDieMat);
            upperDieShoe.position.set(0, -(stampingRamH / 2 + stampingUpperDieShoeH / 2), 0);
            upperDieShoe.castShadow = true; upperDieShoe.receiveShadow = true;
            stampingRamGroup.add(upperDieShoe);

            [-(stampingDieW / 2 + 0.06), (stampingDieW / 2 + 0.06)].forEach(bx => {
                [-(stampingDieD / 2 + 0.05), (stampingDieD / 2 + 0.05)].forEach(bz => {
                    const bushing = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.13, 18), stampingBronzeMat);
                    bushing.position.set(bx, -(stampingRamH / 2 + stampingUpperDieShoeH / 2 + 0.02), bz);
                    bushing.castShadow = true;
                    stampingRamGroup.add(bushing);

                    const bushingBore = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.14, 16), stampingBlackMat);
                    bushingBore.position.set(bx, -(stampingRamH / 2 + stampingUpperDieShoeH / 2 + 0.02), bz);
                    stampingRamGroup.add(bushingBore);
                });
            });

            const punchYOffset = -(stampingRamH / 2 + stampingUpperDieShoeH + stampingUpperDieBlockH / 2);
            const punchBlock = new THREE.Mesh(
                new THREE.BoxGeometry(stampingDieW - 0.14, stampingUpperDieBlockH, stampingDieD - 0.12),
                stampingDieMat
            );
            punchBlock.position.set(0, punchYOffset, 0);
            punchBlock.castShadow = true;
            stampingRamGroup.add(punchBlock);

            const punchGroupBack = new THREE.Group();
            const punchGroupFront = new THREE.Group();
            const punchGroupSide = new THREE.Group();

            const buildUpperPunch = (type) => {
                const punchGrp = new THREE.Group();
                let cavW = lowerDieW - 0.34;
                let cavD = lowerDieD - 0.46;
                let cavDepth = 0.055;
                if (type === 'front_panel_ac') {
                    cavW = lowerDieW - 0.5;
                    cavD = lowerDieD - 0.2;
                    cavDepth = 0.085;
                } else if (type === 'side_panel_ac') {
                    cavW = lowerDieW - 0.2;
                    cavD = lowerDieD - 0.7;
                    cavDepth = 0.045;
                }

                const punchW = cavW - 0.10;
                const punchD = cavD - 0.10;
                const punchH = cavDepth + 0.015;

                const punchNose = new THREE.Mesh(
                    new THREE.BoxGeometry(punchW, punchH, punchD),
                    stampingPolishedMat
                );
                punchNose.position.set(0, punchYOffset - stampingUpperDieBlockH / 2 - punchH / 2, 0);
                punchNose.castShadow = true;
                punchGrp.add(punchNose);

                if (type === 'front_panel_ac') {
                    const punchFeatureGrp = new THREE.Group();

                    const fanPunch = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 32), stampingPolishedMat);
                    fanPunch.position.set(0.15, 0, 0);
                    punchFeatureGrp.add(fanPunch);

                    for (let l = -0.3; l <= 0.3; l += 0.08) {
                        const louver = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.04), stampingPolishedMat);
                        louver.position.set(-0.25, 0, l);
                        punchFeatureGrp.add(louver);
                    }

                    punchFeatureGrp.position.set(0, punchYOffset - stampingUpperDieBlockH / 2 - punchH - 0.05, 0);
                    punchGrp.add(punchFeatureGrp);
                } else if (type === 'side_panel_ac') {
                    const punchFeatureGrp = new THREE.Group();
                    for (let l = -0.35; l <= 0.35; l += 0.08) {
                        const louverLeft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.04), stampingPolishedMat);
                        louverLeft.position.set(-0.2, 0, l);
                        punchFeatureGrp.add(louverLeft);

                        const louverRight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.04), stampingPolishedMat);
                        louverRight.position.set(0.2, 0, l);
                        punchFeatureGrp.add(louverRight);
                    }
                    punchFeatureGrp.position.set(0, punchYOffset - stampingUpperDieBlockH / 2 - punchH - 0.01, 0);
                    punchGrp.add(punchFeatureGrp);
                }

                const shoulderY = punchYOffset - stampingUpperDieBlockH / 2 - 0.010;
                const shoulderT = 0.055;
                [
                    { w: punchW, d: shoulderT, x: 0, z: -(cavD / 2 + 0.050) },
                    { w: punchW, d: shoulderT, x: 0, z: (cavD / 2 + 0.050) },
                    { w: shoulderT, d: punchD, x: -(cavW / 2 + 0.050), z: 0 },
                    { w: shoulderT, d: punchD, x: (cavW / 2 + 0.050), z: 0 }
                ].forEach(face => {
                    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(face.w, 0.020, face.d), stampingDieMat);
                    shoulder.position.set(face.x, shoulderY, face.z);
                    shoulder.castShadow = true;
                    punchGrp.add(shoulder);
                });
                return punchGrp;
            };

            punchGroupBack.add(buildUpperPunch('back_panel'));
            punchGroupFront.add(buildUpperPunch('front_panel_ac'));
            punchGroupSide.add(buildUpperPunch('side_panel_ac'));

            stampingRamGroup.add(punchGroupBack, punchGroupFront, punchGroupSide);

            grp.add(stampingRamGroup);

            const updateRamSupports = () => {
                const crownBottomWorldY = stampingColumnTopY;
                const ramTopWorldY = stampingRamGroup.position.y + stampingRamH / 2;
                const supportHeight = Math.max(0.08, crownBottomWorldY - ramTopWorldY);
                ramSupportMembers.forEach(support => {
                    support.scale.y = supportHeight;
                    support.position.y = stampingRamH / 2 + supportHeight / 2;
                });
                pitmanRods.forEach(pitman => {
                    pitman.scale.y = supportHeight;
                    pitman.position.y = stampingRamH / 2 + supportHeight / 2;
                });
                const cylinderBottomWorldY = stampingColumnTopY - 0.47;
                const ramTopWorldYForPistons = stampingRamGroup.position.y + stampingRamH / 2;
                const pistonHeight = Math.max(0.08, cylinderBottomWorldY - ramTopWorldYForPistons + 0.10);
                pistonRods.forEach(pistonRod => {
                    pistonRod.scale.y = pistonHeight;
                    pistonRod.position.y = stampingRamH / 2 + pistonHeight / 2;
                });
            };
            updateRamSupports();

            [-1, 1].forEach(curtainZSign => {
                const cz = stampingCenterZ + curtainZSign * 1.58;
                [-1, 1].forEach(curtainXSign => {
                    const cx = curtainXSign * 1.38;

                    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.68, 0.04), stampingYellowMat);
                    mast.position.set(cx, stampingMaterialY + 0.31, cz);
                    mast.castShadow = true;
                    grp.add(mast);

                    const lensStrip = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.57, 0.015), stampingBlackMat);
                    lensStrip.position.set(cx - curtainXSign * 0.015, stampingMaterialY + 0.31, cz);
                    grp.add(lensStrip);

                    const capLED = new THREE.Mesh(
                        new THREE.SphereGeometry(0.019, 12, 12),
                        new THREE.MeshStandardMaterial({ color: 0x35d15a, emissive: 0x35d15a, emissiveIntensity: 0.8 })
                    );
                    capLED.position.set(cx, stampingMaterialY + 0.66, cz);
                    grp.add(capLED);
                });
            });

            const armBase = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.31, 12), stampingDarkMat);
            armBase.rotation.x = Math.PI / 2;
            armBase.position.set(stampingRightColumnX + stampingColumnW / 2 + 0.09, stampingMaterialY + 0.25, stampingCenterZ - stampingCrownDepth / 2 - 0.11);
            grp.add(armBase);

            const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.26, 0.09), stampingDarkMat);
            consoleBox.position.set(stampingRightColumnX + stampingColumnW / 2 + 0.14, stampingMaterialY + 0.25, stampingCenterZ - stampingCrownDepth / 2 - 0.25);
            consoleBox.rotation.y = -Math.PI / 6;
            consoleBox.castShadow = true;
            grp.add(consoleBox);

            const hmiScreen = new THREE.Mesh(
                new THREE.BoxGeometry(0.19, 0.13, 0.015),
                new THREE.MeshStandardMaterial({ color: 0x08222c, emissive: 0x1fb6ff, emissiveIntensity: 0.5, roughness: 0.35 })
            );
            hmiScreen.position.set(0, 0.06, 0.07);
            consoleBox.add(hmiScreen);

            [0x2fa84f, 0xcf2a24, 0xffb400].forEach((col, i) => {
                const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.015, 12), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 }));
                btn.rotation.x = Math.PI / 2;
                btn.position.set(-0.06 + i * 0.06, -0.06, 0.07);
                consoleBox.add(btn);
            });

            const eStop = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 14), stampingWarningMat);
            eStop.position.set(0.07, -0.12, 0.07);
            consoleBox.add(eStop);

            const sensorY = stampingMaterialY + 0.06;
            const sensorZ = stampingCenterZ - stampingDieD / 2 - 0.09;
            [-1, 1].forEach((sign, i) => {
                const armX = sign * (stampingDieW / 2 + 0.05);

                const sensorArm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.04), stampingDarkMat);
                sensorArm.position.set(armX, sensorY - 0.09, sensorZ);
                grp.add(sensorArm);

                const sensorBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.06), stampingDarkMat);
                sensorBody.position.set(armX, sensorY, sensorZ);
                sensorBody.castShadow = true;
                grp.add(sensorBody);

                const sensorLens = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.016, 0.016, 0.019, 12),
                    new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 0.8 })
                );
                sensorLens.rotation.z = Math.PI / 2;
                sensorLens.position.set(armX - sign * 0.05, sensorY, sensorZ);
                grp.add(sensorLens);

                if (i === 0) sensorLensRef.current = sensorLens;
            });

            const guardGlassMat = new THREE.MeshPhysicalMaterial({
                color: 0xffffff, metalness: 0.1, roughness: 0.1, transmission: 0.9, transparent: true, opacity: 0.5
            });
            const leftGuard = new THREE.Group();
            const glassW = stampingBedDepth;
            const glassH = stampingColumnTopY - stampingBedTopY;
            const glassPanel = new THREE.Mesh(new THREE.BoxGeometry(glassW, glassH, 0.02), guardGlassMat);
            glassPanel.position.set(0, stampingBedTopY + glassH / 2, 0);
            leftGuard.add(glassPanel);

            const tFrame = new THREE.Mesh(new THREE.BoxGeometry(glassW, 0.04, 0.04), stampingYellowMat);
            tFrame.position.set(0, stampingBedTopY + glassH, 0);
            const bFrame = tFrame.clone(); bFrame.position.y = stampingBedTopY;
            const lFrame = new THREE.Mesh(new THREE.BoxGeometry(0.04, glassH, 0.04), stampingYellowMat);
            lFrame.position.set(-glassW / 2, stampingBedTopY + glassH / 2, 0);
            const rFrame = lFrame.clone(); rFrame.position.x = glassW / 2;
            leftGuard.add(tFrame, bFrame, lFrame, rFrame);

            leftGuard.rotation.y = Math.PI / 2;
            leftGuard.position.set(-stampingColumnX - 0.05, 0, stampingCenterZ);

            leftGuard.visible = safeGuardVisible;
            if (frontGuardRef) frontGuardRef.current = leftGuard;
            grp.add(leftGuard);

            return { grp, ramGroup: stampingRamGroup, sensorLens: sensorLensRef.current, updateRamSupports, alertGroup, alertTex, dieGroupBack, dieGroupFront, dieGroupSide, punchGroupBack, punchGroupFront, punchGroupSide };
        }
        const stampingPress = buildStampingPress();
        scene.add(stampingPress.grp);

        /* ===================== VACUUM TRANSFER RAIL 1 ===================== */
        const transferRailMat = new THREE.MeshStandardMaterial({ color: 0x2b2f33, metalness: 0.72, roughness: 0.36 });
        const transferRailBracketMat = new THREE.MeshStandardMaterial({ color: 0x3a3f44, metalness: 0.65, roughness: 0.40 });

        const transferRailY = stampingMaterialTopY + 0.42;
        const transferRailStartZ = cutToLength.cutZ + 0.08;
        const transferRailEndZ = stampingCenterZ + (stampingCrownDepth / 2 - stampingColumnD / 2 - 0.10);
        const transferRailLength = transferRailEndZ - transferRailStartZ;

        const ctlPillarCenterX = (1.15 * 1.35);
        const ctlPillarHalfW = (0.26 * 1.35) / 2;
        const ctlPillarInnerFaceX = ctlPillarCenterX - ctlPillarHalfW;
        const pressInnerPillarX = stampingRightColumnX - stampingColumnW / 2;
        const transferRailSideX = (ctlPillarInnerFaceX + pressInnerPillarX) / 2;

        const ctlMountInset = 0.05;
        const ctlRailMountX = ctlPillarCenterX - ctlMountInset;
        const ctlRailMountArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.18), transferRailBracketMat);
        ctlRailMountArm.position.set(ctlRailMountX, transferRailY, transferRailStartZ);
        ctlRailMountArm.castShadow = true;
        scene.add(ctlRailMountArm);

        const transferRail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, transferRailLength), transferRailMat);
        transferRail.position.set(transferRailSideX, transferRailY, transferRailStartZ + transferRailLength / 2);
        transferRail.castShadow = true;
        transferRail.receiveShadow = true;
        scene.add(transferRail);

        const ctlRailMount = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.20, 0.24), transferRailBracketMat);
        ctlRailMount.position.set(ctlRailMountX, transferRailY, transferRailStartZ);
        ctlRailMount.castShadow = true;
        scene.add(ctlRailMount);

        const pressRailMountArm = new THREE.Mesh(
            new THREE.BoxGeometry(pressInnerPillarX - transferRailSideX, 0.14, 0.18),
            transferRailBracketMat
        );
        pressRailMountArm.position.set((transferRailSideX + pressInnerPillarX) / 2, transferRailY, transferRailEndZ);
        pressRailMountArm.castShadow = true;
        scene.add(pressRailMountArm);

        const pressRailMount = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.20, 0.24), transferRailBracketMat);
        pressRailMount.position.set(pressInnerPillarX, transferRailY, transferRailEndZ);
        pressRailMount.castShadow = true;
        scene.add(pressRailMount);

        /* Moving Rail Handle */
        const transferHandleGroup = new THREE.Group();

        const transferHandleCarriage = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.20, 0.30), transferRailBracketMat);
        transferHandleCarriage.position.set(transferRailSideX, transferRailY, transferRailStartZ + 0.30);
        transferHandleCarriage.castShadow = true;
        transferHandleGroup.add(transferHandleCarriage);

        const transferHandleStem = new THREE.Mesh(new THREE.BoxGeometry(1.5785, 0.09, 0.09), transferRailBracketMat);
        transferHandleStem.position.set(-0.84925, 0, 0);
        transferHandleStem.castShadow = true;
        transferHandleCarriage.add(transferHandleStem);

        const transferHandleGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.28, 16), transferRailMat);
        transferHandleGrip.rotation.z = Math.PI / 2;
        transferHandleGrip.position.set(-1.6385, 0, 0);
        transferHandleGrip.castShadow = true;
        transferHandleCarriage.add(transferHandleGrip);

        const transferVerticalAssembly = new THREE.Group();
        transferHandleCarriage.add(transferVerticalAssembly);

        const transferVerticalHandleBaseLength = 0.12;
        let transferVerticalHandleLength = transferVerticalHandleBaseLength;

        const transferVerticalHandle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.055, 0.055, transferVerticalHandleBaseLength, 16),
            transferRailMat
        );
        transferVerticalHandle.position.set(-1.6385, -transferVerticalHandleBaseLength / 2, 0);
        transferVerticalHandle.castShadow = true;
        transferVerticalAssembly.add(transferVerticalHandle);

        const vacuumHeadGroup = new THREE.Group();
        transferVerticalAssembly.add(vacuumHeadGroup);

        const transferVacuumConnector = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.10, 16), transferRailBracketMat);
        transferVacuumConnector.position.set(-1.6385, -transferVerticalHandleBaseLength - 0.05, 0);
        transferVacuumConnector.castShadow = true;
        vacuumHeadGroup.add(transferVacuumConnector);

        const transferVacuumUpperBase = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), transferRailBracketMat);
        transferVacuumUpperBase.position.set(-1.6385, -transferVerticalHandleBaseLength - 0.115, 0);
        transferVacuumUpperBase.castShadow = true;
        vacuumHeadGroup.add(transferVacuumUpperBase);

        const transferVacuumFingerPositions = [
            [-1.7385, -0.255, -0.10],
            [-1.5385, -0.255, -0.10],
            [-1.7385, -0.255, 0.10],
            [-1.5385, -0.255, 0.10]
        ];

        const transferVacuumFingers = [];
        const transferVacuumCups = [];
        transferVacuumFingerPositions.forEach((pos) => {
            const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 16), transferRailMat);
            finger.position.set(pos[0], -transferVerticalHandleBaseLength - 0.135, pos[2]);
            finger.castShadow = true;
            vacuumHeadGroup.add(finger);
            transferVacuumFingers.push(finger);

            const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.045, 16), transferRailMat);
            cup.position.set(pos[0], -transferVerticalHandleBaseLength - 0.215, pos[2]);
            cup.castShadow = true;
            vacuumHeadGroup.add(cup);
            transferVacuumCups.push(cup);
        });

        function setVacuumGripY(y) {
            transferHandleCarriage.position.y = transferRailY;
            const vacuumCupBottomOffset = 0.3575;
            const requiredLength = Math.max(
                transferVerticalHandleBaseLength,
                transferVerticalHandleBaseLength + (transferRailY - vacuumCupBottomOffset - y)
            );
            transferVerticalHandleLength = requiredLength;
            transferVerticalHandle.scale.y = transferVerticalHandleLength / transferVerticalHandleBaseLength;
            transferVerticalHandle.position.y = -transferVerticalHandleLength / 2;

            const delta = transferVerticalHandleLength - transferVerticalHandleBaseLength;
            vacuumHeadGroup.position.y = -delta;

            transferVerticalAssembly.userData.gripY = transferRailY - delta - 0.3575;
        }

        function getVacuumGripY() {
            return transferVerticalAssembly.userData.gripY ?? transferRailY;
        }
        setVacuumGripY(transferRailY - 0.3575);
        scene.add(transferHandleGroup);

        let transferHandleZ = cutToLength.cutZ + 0.18;

        /* ===================== FORMED PARTS STORAGE CONTAINER ===================== */
        const contW = 2.80;
        const contD = 2.40;
        const contH = 1.25;
        const standH = 1.15;
        const contCenterX = 0;
        const contCenterZ = stampingCenterZ + (stampingBedDepth / 2) + 1.85;
        const baseRunnerH = 0.12;

        const containerBlueMat = new THREE.MeshStandardMaterial({ color: 0x1d4e78, metalness: 0.65, roughness: 0.42 });
        const containerDarkMat = new THREE.MeshStandardMaterial({ color: 0x22262b, metalness: 0.75, roughness: 0.50 });
        const containerRimMat = new THREE.MeshStandardMaterial({ color: 0x163654, metalness: 0.70, roughness: 0.38 });
        const containerYellowMat = new THREE.MeshStandardMaterial({ color: 0xd7a418, metalness: 0.40, roughness: 0.45 });
        const containerGalvMat = new THREE.MeshStandardMaterial({ color: 0x8a9299, metalness: 0.85, roughness: 0.32 });
        const containerStandMat = new THREE.MeshStandardMaterial({ color: 0x2b3036, metalness: 0.70, roughness: 0.48 });
        const containerLabelMat = new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.6, metalness: 0.1 });

        function createContainerMesh() {
            const partsContainerGroup = new THREE.Group();


            const standLegW = 0.12;
            [-1, 1].forEach(sx => {
                [-1, 1].forEach(sz => {
                    const legX = sx * (contW / 2 - standLegW / 2);
                    const legZ = sz * (contD / 2 - standLegW / 2);

                    const footPlate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.24), containerDarkMat);
                    footPlate.position.set(legX, 0.0125, legZ);
                    footPlate.receiveShadow = true;
                    partsContainerGroup.add(footPlate);

                    [-1, 1].forEach(bx => {
                        [-1, 1].forEach(bz => {
                            const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.035, 6), stampingPolishedMat);
                            bolt.position.set(legX + bx * 0.08, 0.035, legZ + bz * 0.08);
                            partsContainerGroup.add(bolt);
                        });
                    });

                    const leg = new THREE.Mesh(new THREE.BoxGeometry(standLegW, standH, standLegW), containerStandMat);
                    leg.position.set(legX, standH / 2, legZ);
                    leg.castShadow = true; leg.receiveShadow = true;
                    partsContainerGroup.add(leg);

                    const legSleeve = new THREE.Mesh(new THREE.BoxGeometry(standLegW + 0.03, 0.22, standLegW + 0.03), containerYellowMat);
                    legSleeve.position.set(legX, 0.11, legZ);
                    partsContainerGroup.add(legSleeve);
                });
            });

            [-1, 1].forEach(sz => {
                const beamX = new THREE.Mesh(new THREE.BoxGeometry(contW, 0.10, standLegW), containerStandMat);
                beamX.position.set(0, standH - 0.05, sz * (contD / 2 - standLegW / 2));
                beamX.castShadow = true;
                partsContainerGroup.add(beamX);
            });
            [-1, 1].forEach(sx => {
                const beamZ = new THREE.Mesh(new THREE.BoxGeometry(standLegW, 0.10, contD - standLegW * 2), containerStandMat);
                beamZ.position.set(sx * (contW / 2 - standLegW / 2), standH - 0.05, 0);
                beamZ.castShadow = true;
                partsContainerGroup.add(beamZ);
            });

            [-1, 1].forEach(sx => {
                const brace = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, contD - standLegW * 2), containerDarkMat);
                brace.position.set(sx * (contW / 2 - standLegW / 2), standH * 0.45, 0);
                partsContainerGroup.add(brace);
            });
            [-1, 1].forEach(sz => {
                const brace = new THREE.Mesh(new THREE.BoxGeometry(contW - standLegW * 2, 0.06, 0.06), containerDarkMat);
                brace.position.set(0, standH * 0.45, sz * (contD / 2 - standLegW / 2));
                partsContainerGroup.add(brace);
            });

            const binBaseY = standH;
            [-0.60, 0.60].forEach(zOffset => {
                const forkPocket = new THREE.Mesh(new THREE.BoxGeometry(contW + 0.04, baseRunnerH, 0.28), containerDarkMat);
                forkPocket.position.set(0, binBaseY + baseRunnerH / 2, zOffset);
                forkPocket.castShadow = true; forkPocket.receiveShadow = true;
                partsContainerGroup.add(forkPocket);

                [-1, 1].forEach(xSign => {
                    const tineHole = new THREE.Mesh(new THREE.BoxGeometry(0.02, baseRunnerH * 0.72, 0.22), stampingBlackMat);
                    tineHole.position.set(xSign * (contW / 2 + 0.021), binBaseY + baseRunnerH / 2, zOffset);
                    partsContainerGroup.add(tineHole);
                });
            });

            [-contW / 2 + 0.08, 0, contW / 2 - 0.08].forEach(xOffset => {
                const baseRunner = new THREE.Mesh(new THREE.BoxGeometry(0.14, baseRunnerH, contD), containerDarkMat);
                baseRunner.position.set(xOffset, binBaseY + baseRunnerH / 2, 0);
                baseRunner.castShadow = true; baseRunner.receiveShadow = true;
                partsContainerGroup.add(baseRunner);
            });

            const contFloor = new THREE.Mesh(new THREE.BoxGeometry(contW, 0.04, contD), containerDarkMat);
            contFloor.position.set(0, binBaseY + baseRunnerH + 0.02, 0);
            contFloor.receiveShadow = true;
            partsContainerGroup.add(contFloor);

            [-0.9, -0.45, 0, 0.45, 0.9].forEach(xOff => {
                const dunnageStrip = new THREE.Mesh(
                    new THREE.BoxGeometry(0.14, 0.03, contD - 0.16),
                    new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.9 })
                );
                dunnageStrip.position.set(xOff, binBaseY + baseRunnerH + 0.04 + 0.015, 0);
                dunnageStrip.receiveShadow = true;
                partsContainerGroup.add(dunnageStrip);
            });

            const wallBaseY = binBaseY + baseRunnerH + 0.04;
            const postH = contH;
            const postSize = 0.11;

            [-1, 1].forEach(sx => {
                [-1, 1].forEach(sz => {
                    const postX = sx * (contW / 2 - postSize / 2);
                    const postZ = sz * (contD / 2 - postSize / 2);

                    const post = new THREE.Mesh(new THREE.BoxGeometry(postSize, postH, postSize), containerDarkMat);
                    post.position.set(postX, wallBaseY + postH / 2, postZ);
                    post.castShadow = true; post.receiveShadow = true;
                    partsContainerGroup.add(post);

                    const stackEar = new THREE.Mesh(new THREE.BoxGeometry(postSize + 0.05, 0.10, postSize + 0.05), containerYellowMat);
                    stackEar.position.set(postX, wallBaseY + postH + 0.05, postZ);
                    stackEar.castShadow = true;
                    partsContainerGroup.add(stackEar);

                    const liftTab = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.08, 0.08), containerGalvMat);
                    liftTab.position.set(postX + sx * 0.025, wallBaseY + postH + 0.11, postZ);
                    partsContainerGroup.add(liftTab);

                    const foot = new THREE.Mesh(new THREE.BoxGeometry(postSize + 0.04, baseRunnerH + 0.02, postSize + 0.04), containerDarkMat);
                    foot.position.set(postX, binBaseY + (baseRunnerH + 0.02) / 2, postZ);
                    foot.castShadow = true;
                    partsContainerGroup.add(foot);
                });
            });

            const wallThickness = 0.025;
            [-1, 1].forEach(signX => {
                const wallX = signX * (contW / 2 - wallThickness / 2);

                const sideWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, postH, contD - postSize * 2), containerBlueMat);
                sideWall.position.set(wallX, wallBaseY + postH / 2, 0);
                sideWall.castShadow = true; sideWall.receiveShadow = true;
                partsContainerGroup.add(sideWall);

                [-0.38, -0.12, 0.12, 0.38].forEach(yOff => {
                    const rib = new THREE.Mesh(new THREE.BoxGeometry(wallThickness + 0.035, 0.065, contD - postSize * 2 - 0.04), containerBlueMat);
                    rib.position.set(wallX, wallBaseY + postH / 2 + yOff, 0);
                    rib.castShadow = true;
                    partsContainerGroup.add(rib);
                });

                const topRim = new THREE.Mesh(new THREE.BoxGeometry(postSize * 0.95, 0.065, contD - postSize * 2), containerRimMat);
                topRim.position.set(wallX, wallBaseY + postH - 0.0325, 0);
                topRim.castShadow = true;
                partsContainerGroup.add(topRim);
            });

            const rearWallZ = contD / 2 - wallThickness / 2;
            const rearWall = new THREE.Mesh(new THREE.BoxGeometry(contW - postSize * 2, postH, wallThickness), containerBlueMat);
            rearWall.position.set(0, wallBaseY + postH / 2, rearWallZ);
            rearWall.castShadow = true; rearWall.receiveShadow = true;
            partsContainerGroup.add(rearWall);

            [-0.38, -0.12, 0.12, 0.38].forEach(yOff => {
                const rib = new THREE.Mesh(new THREE.BoxGeometry(contW - postSize * 2 - 0.04, 0.065, wallThickness + 0.035), containerBlueMat);
                rib.position.set(0, wallBaseY + postH / 2 + yOff, rearWallZ);
                rib.castShadow = true;
                partsContainerGroup.add(rib);
            });

            const rearTopRim = new THREE.Mesh(new THREE.BoxGeometry(contW - postSize * 2, 0.065, postSize * 0.95), containerRimMat);
            rearTopRim.position.set(0, wallBaseY + postH - 0.0325, rearWallZ);
            rearTopRim.castShadow = true;
            partsContainerGroup.add(rearTopRim);

            const frontWallZ = -contD / 2 + wallThickness / 2;
            const frontWallH = 0.55;
            const frontWall = new THREE.Mesh(new THREE.BoxGeometry(contW - postSize * 2, frontWallH, wallThickness), containerBlueMat);
            frontWall.position.set(0, wallBaseY + frontWallH / 2, frontWallZ);
            frontWall.castShadow = true; frontWall.receiveShadow = true;
            partsContainerGroup.add(frontWall);

            [-0.14, 0.14].forEach(yOff => {
                const rib = new THREE.Mesh(new THREE.BoxGeometry(contW - postSize * 2 - 0.04, 0.06, wallThickness + 0.035), containerBlueMat);
                rib.position.set(0, wallBaseY + frontWallH / 2 + yOff, frontWallZ);
                rib.castShadow = true;
                partsContainerGroup.add(rib);
            });

            const frontTopRim = new THREE.Mesh(new THREE.BoxGeometry(contW - postSize * 2, 0.05, postSize * 0.95), containerRimMat);
            frontTopRim.position.set(0, wallBaseY + frontWallH - 0.025, frontWallZ);
            frontTopRim.castShadow = true;
            partsContainerGroup.add(frontTopRim);

            const placard = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.30, 0.02), containerLabelMat);
            placard.position.set(contW / 2 + 0.015, wallBaseY + postH * 0.65, 0);
            partsContainerGroup.add(placard);

            const placardBorder = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.34, 0.01), containerDarkMat);
            placardBorder.position.set(contW / 2 + 0.010, wallBaseY + postH * 0.65, 0);
            partsContainerGroup.add(placardBorder);

            const hazardPlate = new THREE.Mesh(
                new THREE.PlaneGeometry(contW - 0.3, 0.09),
                new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.85 })
            );
            hazardPlate.position.set(0, binBaseY + baseRunnerH * 0.5, frontWallZ - 0.018);
            partsContainerGroup.add(hazardPlate);

            const standHazard = hazardPlate.clone();
            standHazard.position.set(0, standH * 0.5, frontWallZ - 0.018);
            partsContainerGroup.add(standHazard);

            const rearHazardPlate = hazardPlate.clone();
            rearHazardPlate.rotation.y = Math.PI;
            rearHazardPlate.position.set(0, binBaseY + baseRunnerH * 0.5, rearWallZ + 0.018);
            partsContainerGroup.add(rearHazardPlate);

            return partsContainerGroup;
        }

        const MAX_CONTAINERS = 10;
        const containers = [];
        for (let i = 0; i < MAX_CONTAINERS; i++) {
            const containerGroup = createContainerMesh();
            // Start at empty queue position (left side, spaced out by 3.2m)
            // Container 0 starts at the active position
            const startX = i === 0 ? contCenterX : contCenterX - (3.2 * i);
            containerGroup.position.set(startX, 0, contCenterZ);
            scene.add(containerGroup);
            containers.push(containerGroup);
        }

        /* ===================== EXIT-SIDE VACUUM TRANSFER RAIL ===================== */
        const exitTransferRailMat = transferRailMat;
        const exitTransferBracketMat = transferRailBracketMat;

        const exitRailY = transferRailY;
        const exitRailSideX = transferRailSideX;
        const exitRailStartZ = stampingCenterZ - 0.20;
        const exitRailEndZ = contCenterZ + 0.45;
        const exitRailLength = exitRailEndZ - exitRailStartZ;
        const exitStandbyZ = stampingCenterZ + (stampingBedDepth / 2) + 0.35;

        const exitTransferRail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, exitRailLength), exitTransferRailMat);
        exitTransferRail.position.set(exitRailSideX, exitRailY, exitRailStartZ + exitRailLength / 2);
        exitTransferRail.castShadow = true; exitTransferRail.receiveShadow = true;
        scene.add(exitTransferRail);

        const exitPressMountArm = new THREE.Mesh(
            new THREE.BoxGeometry(pressInnerPillarX - exitRailSideX, 0.14, 0.18),
            exitTransferBracketMat
        );
        exitPressMountArm.position.set((exitRailSideX + pressInnerPillarX) / 2, exitRailY, exitRailStartZ + 0.15);
        exitPressMountArm.castShadow = true;
        scene.add(exitPressMountArm);

        const exitPressMount = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.20, 0.24), exitTransferBracketMat);
        exitPressMount.position.set(pressInnerPillarX, exitRailY, exitRailStartZ + 0.15);
        exitPressMount.castShadow = true;
        scene.add(exitPressMount);

        const exitStanchion = new THREE.Mesh(new THREE.BoxGeometry(0.12, exitRailY, 0.12), exitTransferBracketMat);
        exitStanchion.position.set(exitRailSideX, exitRailY / 2, exitRailEndZ - 0.08);
        exitStanchion.castShadow = true; exitStanchion.receiveShadow = true;
        scene.add(exitStanchion);

        const exitStanchionSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.25, 0.16), containerYellowMat);
        exitStanchionSleeve.position.set(exitRailSideX, 0.125, exitRailEndZ - 0.08);
        scene.add(exitStanchionSleeve);

        const exitStanchionFoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.24), containerDarkMat);
        exitStanchionFoot.position.set(exitRailSideX, 0.0125, exitRailEndZ - 0.08);
        scene.add(exitStanchionFoot);

        const exitTransferGroup = new THREE.Group();

        const exitCarriage = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.20, 0.30), exitTransferBracketMat);
        exitCarriage.position.set(exitRailSideX, exitRailY, exitStandbyZ);
        exitCarriage.castShadow = true;
        exitTransferGroup.add(exitCarriage);

        const exitHandleStem = new THREE.Mesh(new THREE.BoxGeometry(1.5785, 0.09, 0.09), exitTransferBracketMat);
        exitHandleStem.position.set(-0.84925, 0, 0);
        exitHandleStem.castShadow = true;
        exitCarriage.add(exitHandleStem);

        const exitHandleGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.28, 16), exitTransferRailMat);
        exitHandleGrip.rotation.z = Math.PI / 2;
        exitHandleGrip.position.set(-1.6385, 0, 0);
        exitHandleGrip.castShadow = true;
        exitCarriage.add(exitHandleGrip);

        const exitVerticalAssembly = new THREE.Group();
        exitCarriage.add(exitVerticalAssembly);

        const exitVerticalBaseLength = 0.12;
        const exitVerticalHandle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.055, 0.055, exitVerticalBaseLength, 16),
            exitTransferRailMat
        );
        exitVerticalHandle.position.set(-1.6385, -exitVerticalBaseLength / 2, 0);
        exitVerticalHandle.castShadow = true;
        exitVerticalAssembly.add(exitVerticalHandle);

        const exitVacuumConnector = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.10, 16), exitTransferBracketMat);
        exitVacuumConnector.position.set(-1.6385, -exitVerticalBaseLength - 0.05, 0);
        exitVacuumConnector.castShadow = true;
        exitVerticalAssembly.add(exitVacuumConnector);

        const exitVacuumUpperBase = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), exitTransferBracketMat);
        exitVacuumUpperBase.position.set(-1.6385, -exitVerticalBaseLength - 0.115, 0);
        exitVacuumUpperBase.castShadow = true;
        exitVerticalAssembly.add(exitVacuumUpperBase);

        const exitVacuumFingers = [];
        const exitVacuumCups = [];
        const exitVacuumPositions = [
            [-1.7385, -0.255, -0.10],
            [-1.5385, -0.255, -0.10],
            [-1.7385, -0.255, 0.10],
            [-1.5385, -0.255, 0.10]
        ];
        exitVacuumPositions.forEach(pos => {
            const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 16), exitTransferRailMat);
            finger.position.set(pos[0], -exitVerticalBaseLength - 0.135, pos[2]);
            finger.castShadow = true;
            exitVerticalAssembly.add(finger);
            exitVacuumFingers.push(finger);

            const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.045, 16), exitTransferRailMat);
            cup.position.set(pos[0], -exitVerticalBaseLength - 0.215, pos[2]);
            cup.castShadow = true;
            exitVerticalAssembly.add(cup);
            exitVacuumCups.push(cup);
        });

        scene.add(exitTransferGroup);

        function setExitVacuumGripY(targetY) {
            const delta = (exitRailY - 0.3575) - targetY;
            const newLength = Math.max(0.02, exitVerticalBaseLength + delta);
            exitVerticalHandle.scale.y = newLength / exitVerticalBaseLength;
            exitVerticalHandle.position.y = -newLength / 2;
            exitVacuumConnector.position.y = -exitVerticalBaseLength - 0.05 - delta;
            exitVacuumUpperBase.position.y = -exitVerticalBaseLength - 0.115 - delta;
            exitVacuumFingers.forEach(finger => {
                finger.position.y = -exitVerticalBaseLength - 0.135 - delta;
            });
            exitVacuumCups.forEach(cup => {
                cup.position.y = -exitVerticalBaseLength - 0.215 - delta;
            });
            exitVerticalAssembly.userData.gripY = targetY;
        }

        function getExitVacuumGripY() {
            return exitVerticalAssembly.userData.gripY ?? (exitRailY - 0.3575);
        }
        setExitVacuumGripY(exitRailY - 0.3575);

        let exitTransferState = 'waitDie';
        let exitTransferTimer = 0;
        let exitTransferSheet = null;
        let exitTransferCarriageZ = exitStandbyZ;
        const createInitialState = (modelId) => {
            const pConfig = getPanelConfig(modelId);
            const q = [];
            for (let i = 1; i < pConfig.totalContainers; i++) q.push(i);
            return {
                totalProduced: 0,
                totalPiecesCut: 0,
                storedParts: 0,
                activePhysicalIndex: 0,
                exitContainerStackCount: 0,
                fullStorage: [],
                queue: q,
                containerSwapState: 'IDLE',
                containerSwapProgress: 0,
                growingIndex: 0,
                materialExhaustedAlertShown: false
            };
        };

        const panelStates = {
            back_panel: createInitialState('back_panel'),
            front_panel_ac: createInitialState('front_panel_ac'),
            side_panel_ac: createInitialState('side_panel_ac')
        };
        const getCurState = () => panelStates[selectedModelRef.current] || panelStates.back_panel;

        const exitPickupZ = stampingCenterZ;
        const exitPlaceZ = contCenterZ;
        const exitGripRestY = exitRailY - 0.3575;
        const exitLowerDiePickupY = stampingMaterialY + stripThickness / 2;

        /* ===================== STAMPING STATE MACHINE ===================== */
        let stampingState = 'waiting';
        let stampingTimer = 0;
        let stampingMaterialPresent = false;
        let stampingReadySheet = null;

        function updateStampedSheetForm(sheet, progress) {
            if (!sheet || !sheet.geometry || !sheet.userData.formBasePositions) return;
            const pos = sheet.geometry.attributes.position;
            const base = sheet.userData.formBasePositions;
            const t = THREE.MathUtils.clamp(progress, 0, 1);

            let edgeStartX = 0.78, edgeStartZ = 0.78;
            let targetHeight = 0.06;

            const model = selectedModelRef.current;
            if (model === 'front_panel_ac') {
                edgeStartX = 0.60;
                edgeStartZ = 0.85;
                targetHeight = 0.085;
            } else if (model === 'side_panel_ac') {
                edgeStartX = 0.90;
                edgeStartZ = 0.50;
                targetHeight = 0.045;
            }

            const lipHeight = targetHeight * t;

            const localHalfX = coilWidth / 2;
            const localHalfZ = 0.5;

            for (let i = 0; i < pos.count; i++) {
                const x = base[i * 3];
                const y = base[i * 3 + 1];
                const z = base[i * 3 + 2];

                const nx = Math.abs(x) / localHalfX;
                const nz = Math.abs(z) / localHalfZ;

                const edgeX = THREE.MathUtils.smoothstep(nx, edgeStartX, 1.0);
                const edgeZ = THREE.MathUtils.smoothstep(nz, edgeStartZ, 1.0);
                const edgeFactor = Math.max(edgeX, edgeZ);

                let newY = y + lipHeight * edgeFactor;

                if (model === 'front_panel_ac') {
                    sheet.material = cutToLength.frontPanelPieceMat;

                    // Slightly off-center fan hole
                    const holeX = 0.15;
                    const holeZ = 0.0;
                    const fanRadius = 0.22;
                    const dist = Math.sqrt((x - holeX) * (x - holeX) + (z - holeZ) * (z - holeZ));

                    if (dist > fanRadius && dist < fanRadius + 0.04) {
                        // Sharp rim around the hole
                        const depth = THREE.MathUtils.smoothstep(dist, fanRadius, fanRadius + 0.04);
                        newY -= 0.03 * (1 - depth) * t;
                    }

                    // Louvers on the left side
                    if (x < -0.15 && x > -0.40 && Math.abs(z) < 0.35) {
                        const louverFreq = 40;
                        newY += Math.sin(z * louverFreq) * 0.012 * t;
                    }
                } else if (model === 'side_panel_ac') {
                    sheet.material = cutToLength.pieceMat;
                    // Two precise columns of ventilation louvers matching the punch
                    if (Math.abs(x) > 0.05 && Math.abs(x) < 0.35 && Math.abs(z) < 0.38) {
                        const louverFreq = 78.54; // Aligns with 0.08 spacing on punch
                        const louverShape = Math.sin(z * louverFreq);
                        if (louverShape > 0) {
                            newY += louverShape * 0.015 * t;
                        }
                    }
                } else {
                    sheet.material = cutToLength.pieceMat;
                }

                pos.setY(i, newY);
            }
            pos.needsUpdate = true;
            sheet.geometry.computeVertexNormals();
        }

        function updateStampingPress(dt) {
            switch (stampingState) {
                case 'waiting':
                    stampingPress.ramGroup.position.y = stampingRamIdleY;
                    stampingPress.updateRamSupports?.();
                    if (stampingMaterialPresent) {
                        stampingState = 'detecting';
                        stampingTimer = 0;
                    }
                    break;
                case 'detecting': {
                    stampingTimer += dt;
                    const entryClear = transferHandleCarriage.position.z <= (stampingCenterZ - 1.15);
                    const exitClear = exitCarriage.position.z >= (stampingCenterZ + 1.15);
                    if (stampingTimer >= 0.15 && entryClear && exitClear) {
                        stampingState = 'descending';
                        stampingTimer = 0;
                    }
                    break;
                }
                case 'descending': {
                    stampingTimer += dt;
                    const t = Math.min(stampingTimer / 0.35, 1);
                    stampingPress.ramGroup.position.y = THREE.MathUtils.lerp(stampingRamIdleY, stampingRamDownY, t);
                    stampingPress.updateRamSupports?.();
                    if (t >= 1) {
                        stampingState = 'forming';
                        stampingTimer = 0;
                    }
                    break;
                }
                case 'forming': {
                    const formingDepth = 0.035;
                    stampingTimer += dt;
                    const t = Math.min(stampingTimer / 0.18, 1);
                    stampingPress.ramGroup.position.y = THREE.MathUtils.lerp(stampingRamDownY, stampingRamDownY - formingDepth, t);
                    stampingPress.updateRamSupports?.();

                    if (t >= 1) {
                        updateStampedSheetForm(stampingReadySheet, 1);
                        stampingState = 'holding';
                        stampingTimer = 0;
                    }
                    break;
                }
                case 'holding':
                    stampingTimer += dt;
                    if (stampingTimer >= 0.25) {
                        stampingState = 'ascending';
                        stampingTimer = 0;
                    }
                    break;
                case 'ascending': {
                    stampingTimer += dt;
                    const formingDepth = 0.035;
                    const t = Math.min(stampingTimer / 0.4, 1);
                    stampingPress.ramGroup.position.y = THREE.MathUtils.lerp(stampingRamDownY - formingDepth, stampingRamIdleY, t);
                    stampingPress.updateRamSupports?.();
                    if (t >= 1) {
                        stampingState = 'waiting';
                        stampingTimer = 0;
                        stampingMaterialPresent = false;
                        if (stampingReadySheet) {
                            stampingReadySheet.userData.onLowerDie = true;
                            stampingReadySheet.userData.formed = true;
                            stampingReadySheet.userData.readyForExit = true;
                        }
                        stampingReadySheet = null;
                    }
                    break;
                }
            }
            if (stampingPress.sensorLens) {
                const stampingActive = stampingState !== 'waiting';
                stampingPress.sensorLens.material.color.setHex(stampingActive ? 0x35d15a : 0xff3b30);
                stampingPress.sensorLens.material.emissive.setHex(stampingActive ? 0x35d15a : 0xff3b30);
            }
        }

        function updateExitVacuumTransfer(dt) {
            const st = getCurState();
            exitTransferTimer += dt;
            const stackHeightOffset = Math.min(st.exitContainerStackCount, 25) * 0.028;
            const exitContainerDepositY = 1.35 + stackHeightOffset;

            switch (exitTransferState) {
                case 'waitDie':
                    exitTransferCarriageZ = exitStandbyZ;
                    exitCarriage.position.z = exitStandbyZ;
                    setExitVacuumGripY(exitGripRestY);

                    if (stampingState === 'waiting' &&
                        stampingPress.ramGroup.position.y >= (stampingRamIdleY - 0.04)) {
                        const candidate = cutToLength.pieces.find(p =>
                            p.visible && p.userData.readyForExit && !p.userData.exitVacuumHeld
                        );
                        if (candidate) {
                            exitTransferSheet = candidate;
                            exitTransferState = 'moveToDie';
                            exitTransferTimer = 0;
                        }
                    }
                    break;

                case 'moveToDie':
                    exitTransferCarriageZ = THREE.MathUtils.lerp(
                        exitTransferCarriageZ,
                        exitPickupZ,
                        Math.min(1, dt * 14.0)
                    );
                    exitCarriage.position.z = exitTransferCarriageZ;
                    setExitVacuumGripY(exitGripRestY);

                    if (Math.abs(exitTransferCarriageZ - exitPickupZ) < 0.03) {
                        exitTransferCarriageZ = exitPickupZ;
                        exitCarriage.position.z = exitPickupZ;
                        exitTransferTimer = 0;
                        exitTransferState = 'lowerToDie';
                    }
                    break;

                case 'lowerToDie':
                    setExitVacuumGripY(
                        THREE.MathUtils.lerp(
                            exitGripRestY,
                            exitLowerDiePickupY,
                            Math.min(1, exitTransferTimer / 0.07)
                        )
                    );
                    if (exitTransferTimer >= 0.07) {
                        if (exitTransferSheet && exitTransferSheet.visible) {
                            exitTransferSheet.userData.exitVacuumHeld = true;
                            exitTransferSheet.userData.readyForExit = false;
                            exitTransferSheet.userData.onLowerDie = false;
                            exitTransferTimer = 0;
                            exitTransferState = 'grip';
                        } else {
                            exitTransferState = 'waitDie';
                        }
                    }
                    break;

                case 'grip':
                    if (exitTransferTimer >= 0.04) {
                        exitTransferTimer = 0;
                        exitTransferState = 'liftFromDie';
                    }
                    break;

                case 'liftFromDie':
                    setExitVacuumGripY(
                        THREE.MathUtils.lerp(
                            exitLowerDiePickupY,
                            exitGripRestY,
                            Math.min(1, exitTransferTimer / 0.08)
                        )
                    );
                    if (exitTransferTimer >= 0.08) {
                        exitTransferTimer = 0;
                        exitTransferState = 'carryToContainer';
                    }
                    break;

                case 'carryToContainer':
                    exitTransferCarriageZ = THREE.MathUtils.lerp(
                        exitTransferCarriageZ,
                        exitPlaceZ,
                        Math.min(1, dt * 12.0)
                    );
                    exitCarriage.position.z = exitTransferCarriageZ;
                    setExitVacuumGripY(exitGripRestY);

                    if (Math.abs(exitTransferCarriageZ - exitPlaceZ) < 0.03) {
                        exitTransferCarriageZ = exitPlaceZ;
                        exitCarriage.position.z = exitPlaceZ;
                        exitTransferTimer = 0;
                        exitTransferState = 'lowerIntoContainer';
                    }
                    break;

                case 'lowerIntoContainer':
                    setExitVacuumGripY(
                        THREE.MathUtils.lerp(
                            exitGripRestY,
                            exitContainerDepositY,
                            Math.min(1, exitTransferTimer / 0.09)
                        )
                    );
                    if (exitTransferTimer >= 0.09) {
                        exitTransferTimer = 0;
                        exitTransferState = 'release';
                    }
                    break;

                case 'release':
                    if (exitTransferSheet) {
                        exitTransferSheet.userData.exitVacuumHeld = false;
                        exitTransferSheet.userData.inContainer = true;
                        exitTransferSheet.userData.containerIndex = st.activePhysicalIndex;
                        exitTransferSheet.userData.containerPlacedX = 0;
                        exitTransferSheet.position.set(0, exitContainerDepositY, exitPlaceZ);
                        st.exitContainerStackCount++;
                        st.totalProduced++;
                        exitTransferSheet = null;
                    }
                    if (exitTransferTimer >= 0.04) {
                        exitTransferTimer = 0;
                        exitTransferState = 'liftAfterRelease';
                    }
                    break;

                case 'liftAfterRelease':
                    setExitVacuumGripY(
                        THREE.MathUtils.lerp(
                            exitContainerDepositY,
                            exitGripRestY,
                            Math.min(1, exitTransferTimer / 0.08)
                        )
                    );
                    if (exitTransferTimer >= 0.08) {
                        exitTransferTimer = 0;
                        exitTransferState = 'returnToStandby';
                    }
                    break;

                case 'returnToStandby':
                    exitTransferCarriageZ = THREE.MathUtils.lerp(
                        exitTransferCarriageZ,
                        exitStandbyZ,
                        Math.min(1, dt * 14.0)
                    );
                    exitCarriage.position.z = exitTransferCarriageZ;
                    setExitVacuumGripY(exitGripRestY);

                    if (Math.abs(exitTransferCarriageZ - exitStandbyZ) < 0.03) {
                        exitTransferCarriageZ = exitStandbyZ;
                        exitCarriage.position.z = exitStandbyZ;
                        exitTransferTimer = 0;
                        exitTransferState = 'waitDie';
                    }
                    break;
            }

            if (exitTransferSheet && exitTransferSheet.userData.exitVacuumHeld) {
                exitTransferSheet.position.x = 0;
                exitTransferSheet.position.z = exitCarriage.position.z;
                exitTransferSheet.position.y = getExitVacuumGripY() - stripThickness / 2;
            }
        }

        /* ===================== ANIMATION LOOP ===================== */
        let spinAngle = 0;
        let fedLength = 0;
        let scrollOffset = 0;
        let lengthSinceCut = 0;
        let bladePhase = 'idle';
        let bladeTimer = 0;
        let lastTime = performance.now();

        let vacuumTransferState = 'toPickup';
        let vacuumTransferTimer = 0;
        let vacuumTransferSheet = null;
        let cutReadySheet = null;

        let animationFrameId;
        let lastReportTime = 0;

        function animate() {
            const st = getCurState();
            const pConfig = getPanelConfig(selectedModelRef.current);
            if (emptyTriggerRef.current > lastEmptyTriggerRef.current) {
                lastEmptyTriggerRef.current = emptyTriggerRef.current;
                if (st.fullStorage.length > 0) {
                    const emptiedIdx = st.fullStorage.pop(); // Remove the OLDEST full container
                    st.queue.push(emptiedIdx); // Return to queue
                    st.storedParts += pConfig.capacity;
                    // Hide its parts
                    cutToLength.pieces.forEach(p => {
                        if (p.userData.inContainer && p.userData.containerIndex === emptiedIdx) {
                            p.visible = false;
                            p.userData.inContainer = false;
                        }
                    });
                }
            }

            if (modelChangeTriggerRef.current > lastModelChangeTriggerRef.current) {
                lastModelChangeTriggerRef.current = modelChangeTriggerRef.current;

                // Reset machine state
                const q = [];
                for (let i = 1; i < pConfig.totalContainers; i++) q.push(i);
                st.queue = q;
                st.fullStorage = [];
                st.activePhysicalIndex = 0;
                st.totalProduced = 0;
                st.totalPiecesCut = 0;
                st.storedParts = 0;
                st.exitContainerStackCount = 0;
                st.containerSwapState = 'IDLE';
                st.growingIndex = 0;
                st.materialExhaustedAlertShown = false;

                fedLength = 0;
                lengthSinceCut = 0;
                bladePhase = 'idle';
                bladeTimer = 0;
                stampingState = 'waiting';
                stampingTimer = 0;
                stampingMaterialPresent = false;

                vacuumTransferState = 'toPickup';
                vacuumTransferTimer = 0;
                exitTransferState = 'waitDie';
                exitTransferTimer = 0;

                if (cutReadySheet) { cutReadySheet.userData.cutReady = false; cutReadySheet = null; }
                if (vacuumTransferSheet) { vacuumTransferSheet.userData.vacuumHeld = false; vacuumTransferSheet = null; }
                if (stampingReadySheet) { stampingReadySheet.userData.onLowerDie = false; stampingReadySheet = null; }
                if (exitTransferSheet) { exitTransferSheet.userData.exitVacuumHeld = false; exitTransferSheet = null; }

                cutToLength.pieces.forEach(p => {
                    p.visible = false;
                    p.userData.cutReady = false;
                    p.userData.vacuumHeld = false;
                    p.userData.onLowerDie = false;
                    p.userData.formed = false;
                    p.userData.readyForExit = false;
                    p.userData.exitVacuumHeld = false;
                    p.userData.inContainer = false;
                    p.position.set(0, cutToLength.pieceCenterY, cutToLength.cutZ);
                    const pos = p.geometry.attributes.position;
                    const base = p.userData.formBasePositions;
                    if (pos && base) {
                        pos.array.set(base);
                        pos.needsUpdate = true;
                        p.geometry.computeVertexNormals();
                    }
                    p.material = cutToLength.pieceMat;
                });

                containers.forEach(c => c.position.x = 100); // Hide them initially until active
            }

            animationFrameId = requestAnimationFrame(animate);
            const nowTime = performance.now();
            const dtRaw = (nowTime - lastTime) / 1000;
            lastTime = nowTime;

            const baseDt = Math.min(dtRaw, 0.05);
            const currentRPM = speedRef.current;
            const timeScale = (currentRPM > 0) ? (currentRPM / 4.594) : 1;
            const dt = baseDt * timeScale;

            const currentModel = selectedModelRef.current;
            stampingPress.dieGroupBack.visible = (!currentModel || currentModel === 'back_panel');
            stampingPress.dieGroupFront.visible = (currentModel === 'front_panel_ac');
            stampingPress.dieGroupSide.visible = (currentModel === 'side_panel_ac');

            stampingPress.punchGroupBack.visible = (!currentModel || currentModel === 'back_panel');
            stampingPress.punchGroupFront.visible = (currentModel === 'front_panel_ac');
            stampingPress.punchGroupSide.visible = (currentModel === 'side_panel_ac');

            const allFull = st.containerSwapState === 'WAITING_FOR_EMPTY';
            if (allFull) {
                stampingPress.alertGroup.visible = true;
                stampingPress.alertTex.offset.x -= dt * 0.4;
            } else {
                stampingPress.alertGroup.visible = false;
            }

            // Apply static positions for any container NOT actively animating
            if (st.containerSwapState === 'IDLE' || st.containerSwapState === 'WAITING_FOR_EMPTY') {
                containers[st.activePhysicalIndex].position.set(contCenterX, 0, contCenterZ);
                st.queue.forEach((qIdx, q) => {
                    containers[qIdx].position.set(contCenterX - 3.2 * (q + 1), 0, contCenterZ);
                });
                st.fullStorage.forEach((fIdx, j) => {
                    containers[fIdx].position.set(contCenterX + 3.2 * (j + 1), 0, contCenterZ + 2.0);
                });
                // Hide unused containers
                containers.forEach((c, idx) => {
                    if (idx !== st.activePhysicalIndex && !st.queue.includes(idx) && !st.fullStorage.includes(idx)) {
                        c.position.set(100, 0, 100);
                    }
                });
            }

            if (playingRef.current) {
                if (st.containerSwapState === 'IDLE') {
                    if (st.exitContainerStackCount >= pConfig.capacity) {
                        if (st.queue.length > 0) {
                            st.containerSwapState = 'SWAPPING';
                            st.containerSwapProgress = 0;
                        } else {
                            st.containerSwapState = 'WAITING_FOR_EMPTY';
                        }
                    }
                }

                if (st.containerSwapState === 'WAITING_FOR_EMPTY' && st.queue.length > 0) {
                    st.containerSwapState = 'SWAPPING';
                    st.containerSwapProgress = 0;
                }

                if (st.containerSwapState === 'SWAPPING') {
                    st.containerSwapProgress += dt * 0.5; // 2 seconds to swap
                    const t = THREE.MathUtils.clamp(st.containerSwapProgress, 0, 1);

                    let zPhase = t < 0.3 ? t / 0.3 : 1;
                    let xPhase = t < 0.3 ? 0 : (t - 0.3) / 0.7;
                    const easeZ = zPhase < 0.5 ? 2 * zPhase * zPhase : -1 + (4 - 2 * zPhase) * zPhase;
                    const easeX = xPhase < 0.5 ? 2 * xPhase * xPhase : -1 + (4 - 2 * xPhase) * xPhase;

                    // 1. Move previously full containers
                    for (let j = 0; j < st.fullStorage.length; j++) {
                        const cIdx = st.fullStorage[j];
                        const container = containers[cIdx];
                        const startX = contCenterX + 3.2 * (j + 1);
                        const targetX = contCenterX + 3.2 * (j + 2);
                        container.position.x = THREE.MathUtils.lerp(startX, targetX, easeX);
                        container.position.z = contCenterZ + 2.0;
                    }

                    // 2. Move the active container to storage
                    const activeContainer = containers[st.activePhysicalIndex];
                    const activeTargetX = contCenterX + 3.2;
                    activeContainer.position.x = THREE.MathUtils.lerp(contCenterX, activeTargetX, easeX);
                    activeContainer.position.z = contCenterZ + 2.0 * easeZ;

                    // 3. Move the next empty container to active
                    if (st.queue.length > 0) {
                        const nextActiveIdx = st.queue[0];
                        const nextContainer = containers[nextActiveIdx];
                        const startEmptyX = contCenterX - 3.2;
                        nextContainer.position.x = THREE.MathUtils.lerp(startEmptyX, contCenterX, easeX);
                        nextContainer.position.z = contCenterZ;

                        // 4. Shift the rest of the queue
                        for (let q = 1; q < st.queue.length; q++) {
                            const qIdx = st.queue[q];
                            const qContainer = containers[qIdx];
                            const startQx = contCenterX - 3.2 * (q + 1);
                            const targetQx = contCenterX - 3.2 * q;
                            qContainer.position.x = THREE.MathUtils.lerp(startQx, targetQx, easeX);
                            qContainer.position.z = contCenterZ;
                        }
                    }

                    cutToLength.pieces.forEach(p => {
                        if (p.userData.inContainer) {
                            const cIdx = p.userData.containerIndex;
                            const container = containers[cIdx];
                            const startX = p.userData.containerPlacedX || 0;
                            // Offset piece relative to its container's current position
                            if (cIdx === st.activePhysicalIndex) {
                                p.position.x = startX + (activeContainer.position.x - contCenterX);
                                p.position.z = activeContainer.position.z;
                            } else if (st.fullStorage.includes(cIdx)) {
                                const j = st.fullStorage.indexOf(cIdx);
                                const baseContX = contCenterX + 3.2 * (j + 1);
                                p.position.x = startX + (container.position.x - baseContX);
                                p.position.z = container.position.z;
                            }
                        }
                    });

                    if (t >= 1) {
                        st.fullStorage.unshift(st.activePhysicalIndex);
                        st.activePhysicalIndex = st.queue.shift();
                        st.exitContainerStackCount = 0;
                        st.containerSwapState = 'IDLE';
                    }
                }

                if (st.containerSwapState === 'IDLE') {
                    vacuumTransferTimer += dt;

                    const pickupZ = cutToLength.cutZ + pConfig.cutLength / 2;
                    const placeZ = stampingCenterZ;
                    const pickupY = cutToLength.pieceCenterY;
                    const lowerDieY = stampingMaterialY + stripThickness / 2;

                    const gripX = -1.6385;
                    const gripRestY = transferRailY - 0.3575;
                    const gripPickupY = pickupY + stripThickness / 2;
                    const gripPlaceY = lowerDieY + stripThickness / 2;

                    function attachSheetToVacuum(sheet) {
                        if (!sheet || !sheet.visible) return;
                        vacuumTransferSheet = sheet;
                        sheet.userData.vacuumHeld = true;
                        sheet.userData.vacuumOffsetY = gripPickupY - sheet.position.y;
                    }

                    function releaseSheetFromVacuum() {
                        if (!vacuumTransferSheet) return;
                        vacuumTransferSheet.userData.vacuumHeld = false;
                        vacuumTransferSheet = null;
                    }

                    switch (vacuumTransferState) {
                        case 'toPickup':
                            transferHandleZ = THREE.MathUtils.lerp(
                                transferHandleZ,
                                pickupZ,
                                Math.min(1, dt * 5.0)
                            );
                            transferHandleCarriage.position.z = transferHandleZ;
                            setVacuumGripY(gripRestY);

                            if (Math.abs(transferHandleZ - pickupZ) < 0.03) {
                                transferHandleZ = pickupZ;
                                transferHandleCarriage.position.z = pickupZ;
                                if (cutReadySheet) {
                                    vacuumTransferTimer = 0;
                                    vacuumTransferState = 'lowerToPickup';
                                }
                            }
                            break;

                        case 'lowerToPickup':
                            setVacuumGripY(
                                THREE.MathUtils.lerp(
                                    gripRestY,
                                    gripPickupY,
                                    Math.min(1, vacuumTransferTimer / 0.08)
                                )
                            );

                            if (vacuumTransferTimer >= 0.08) {
                                const candidate = cutReadySheet &&
                                    cutReadySheet.visible &&
                                    !cutReadySheet.userData.vacuumHeld &&
                                    Math.abs(cutReadySheet.position.z - pickupZ) < 0.08
                                    ? cutReadySheet : null;

                                if (candidate) {
                                    candidate.position.x = transferHandleCarriage.position.x + gripX;
                                    candidate.position.z = pickupZ;
                                    candidate.position.y = pickupY;
                                    attachSheetToVacuum(candidate);
                                    candidate.userData.cutReady = false;
                                    cutReadySheet = null;
                                    vacuumTransferTimer = 0;
                                    vacuumTransferState = 'gripped';
                                }
                            }
                            break;

                        case 'gripped':
                            if (vacuumTransferSheet) {
                                vacuumTransferSheet.position.x = transferHandleCarriage.position.x + gripX;
                                vacuumTransferSheet.position.z = transferHandleCarriage.position.z;
                                vacuumTransferSheet.position.y = pickupY + (getVacuumGripY() - gripPickupY);
                            }

                            if (vacuumTransferTimer >= 0.04) {
                                vacuumTransferTimer = 0;
                                vacuumTransferState = 'liftFromPickup';
                            }
                            break;

                        case 'liftFromPickup':
                            setVacuumGripY(
                                THREE.MathUtils.lerp(
                                    gripPickupY,
                                    gripRestY,
                                    Math.min(1, vacuumTransferTimer / 0.08)
                                )
                            );

                            if (vacuumTransferSheet) {
                                vacuumTransferSheet.position.x = transferHandleCarriage.position.x + gripX;
                                vacuumTransferSheet.position.z = transferHandleCarriage.position.z;
                                vacuumTransferSheet.position.y = pickupY + (getVacuumGripY() - gripPickupY);
                            }

                            if (vacuumTransferTimer >= 0.08) {
                                vacuumTransferTimer = 0;
                                vacuumTransferState = 'carryToPress';
                            }
                            break;

                        case 'carryToPress': {
                            const dieOccupied = (stampingState !== 'waiting') ||
                                (exitCarriage.position.z < exitStandbyZ - 0.15) ||
                                cutToLength.pieces.some(p => p.visible && (p.userData.readyForExit || p.userData.onLowerDie));

                            const targetEntryZ = dieOccupied ? (stampingCenterZ - 1.25) : placeZ;

                            transferHandleZ = THREE.MathUtils.lerp(
                                transferHandleZ,
                                targetEntryZ,
                                Math.min(1, dt * 10.0)
                            );
                            transferHandleCarriage.position.z = transferHandleZ;
                            setVacuumGripY(gripRestY);

                            if (vacuumTransferSheet) {
                                vacuumTransferSheet.position.x = transferHandleCarriage.position.x + gripX;
                                vacuumTransferSheet.position.z = transferHandleCarriage.position.z;
                                vacuumTransferSheet.position.y = pickupY + (getVacuumGripY() - gripPickupY);
                            }

                            if (!dieOccupied && Math.abs(transferHandleZ - placeZ) < 0.03) {
                                transferHandleZ = placeZ;
                                transferHandleCarriage.position.z = placeZ;
                                vacuumTransferTimer = 0;
                                vacuumTransferState = 'lowerToDie';
                            }
                            break;
                        }

                        case 'lowerToDie':
                            setVacuumGripY(
                                THREE.MathUtils.lerp(
                                    gripRestY,
                                    gripPlaceY,
                                    Math.min(1, vacuumTransferTimer / 0.08)
                                )
                            );

                            if (vacuumTransferSheet) {
                                vacuumTransferSheet.position.x = transferHandleCarriage.position.x + gripX;
                                vacuumTransferSheet.position.z = transferHandleCarriage.position.z;
                                vacuumTransferSheet.position.y = lowerDieY + (getVacuumGripY() - gripPlaceY);
                            }

                            if (vacuumTransferTimer >= 0.08) {
                                if (vacuumTransferSheet) {
                                    vacuumTransferSheet.position.set(0, lowerDieY, stampingCenterZ);
                                    stampingReadySheet = vacuumTransferSheet;
                                    vacuumTransferSheet.userData.onLowerDie = true;
                                }
                                vacuumTransferTimer = 0;
                                vacuumTransferState = 'release';
                            }
                            break;

                        case 'release':
                            releaseSheetFromVacuum();
                            if (vacuumTransferTimer >= 0.04) {
                                vacuumTransferTimer = 0;
                                vacuumTransferState = 'liftAfterPlace';
                            }
                            break;

                        case 'liftAfterPlace':
                            setVacuumGripY(
                                THREE.MathUtils.lerp(
                                    gripPlaceY,
                                    gripRestY,
                                    Math.min(1, vacuumTransferTimer / 0.08)
                                )
                            );

                            if (!stampingMaterialPresent &&
                                stampingState === 'waiting' &&
                                stampingReadySheet &&
                                stampingReadySheet.visible &&
                                vacuumTransferTimer >= 0.04) {
                                stampingMaterialPresent = true;
                            }

                            if (vacuumTransferTimer >= 0.08) {
                                vacuumTransferTimer = 0;
                                vacuumTransferState = 'returnToPickup';
                            }
                            break;

                        case 'returnToPickup':
                            transferHandleZ = THREE.MathUtils.lerp(
                                transferHandleZ,
                                pickupZ,
                                Math.min(1, dt * 5.0)
                            );
                            transferHandleCarriage.position.z = transferHandleZ;
                            setVacuumGripY(gripRestY);

                            if (Math.abs(transferHandleZ - pickupZ) < 0.03) {
                                transferHandleZ = pickupZ;
                                transferHandleCarriage.position.z = pickupZ;
                                vacuumTransferTimer = 0;
                                vacuumTransferState = 'toPickup';
                            }
                            break;
                    }

                    if (vacuumTransferSheet && vacuumTransferSheet.userData.vacuumHeld) {
                        vacuumTransferSheet.position.x = transferHandleCarriage.position.x + gripX;
                        vacuumTransferSheet.position.z = transferHandleCarriage.position.z;
                        if (vacuumTransferState !== 'lowerToDie') {
                            vacuumTransferSheet.position.y = pickupY + (getVacuumGripY() - gripPickupY);
                        }
                    }

                    // Use base RPM for visual physics since dt is globally scaled
                    let omega = (4.594 * 2 * Math.PI) / 60;
                    let tangentialSpeed = omega * R;

                    const feedingPaused = (lengthSinceCut >= pConfig.cutLength) || (bladePhase !== 'idle') || st.materialExhaustedAlertShown;
                    if (feedingPaused && fedLength >= curveLength) {
                        omega = 0;
                        tangentialSpeed = 0;
                    }

                    // Fast-forward initial threading animation by 5x
                    if (fedLength < curveLength) {
                        omega *= 5;
                        tangentialSpeed *= 5;
                    }

                    spinAngle -= omega * dt;
                    coilMesh.rotation.y = spinAngle;

                    fedLength = Math.min(curveLength, fedLength + tangentialSpeed * dt);

                    // Dynamically shrink the coil as material is consumed (assuming 500m total length)
                    const totalCoilLength = 500.0;
                    const rInner = 0.15; // inner hole radius
                    const rOuter = 0.45; // initial outer radius
                    const initialArea = Math.PI * (rOuter * rOuter - rInner * rInner);
                    // Calculate how much material has been used globally across all cycles
                    const globalConsumedLength = (st.totalPiecesCut * pConfig.cutLength) + fedLength + lengthSinceCut;
                    const remainingMaterial = Math.max(0, 500.0 - globalConsumedLength);

                    if (remainingMaterial < pConfig.cutLength && !st.materialExhaustedAlertShown) {
                        st.materialExhaustedAlertShown = true;
                        if (typeof window !== 'undefined' && window.onMaterialExhaustedEvent) {
                            window.onMaterialExhaustedEvent();
                        }
                    }

                    const remainingFraction = Math.max(0, remainingMaterial / totalCoilLength);
                    const currentArea = initialArea * remainingFraction;
                    const currentRadius = Math.sqrt((currentArea / Math.PI) + (rInner * rInner));
                    const coilScale = currentRadius / rOuter;
                    coilMesh.scale.set(coilScale, 1, coilScale);

                    // Dynamically update the strip geometry to stay attached to the shrinking coil
                    const dynamicPts = [];
                    const wrapDeg = [-42, -32, -22, -14, -7, -2, 0];
                    wrapDeg.forEach(d => {
                        const a = THREE.MathUtils.degToRad(d);
                        dynamicPts.push(new THREE.Vector3(
                            0,
                            coilCenter.y + currentRadius * Math.cos(a),
                            coilCenter.z + currentRadius * Math.sin(a)
                        ));
                    });
                    dynamicPts.push(new THREE.Vector3(0, 3.78, 0.74));
                    dynamicPts.push(new THREE.Vector3(0, 3.20, 1.48));
                    dynamicPts.push(new THREE.Vector3(0, 2.62, 2.21));
                    dynamicPts.push(new THREE.Vector3(0, 2.35, 3.85));
                    dynamicPts.push(new THREE.Vector3(0, 2.22, 4.25));
                    dynamicPts.push(new THREE.Vector3(0, 2.22, 7.6));
                    const dynamicCurve = new THREE.CatmullRomCurve3(dynamicPts, false, 'centripetal', 0.4);
                    const dynamicSpacedPoints = dynamicCurve.getSpacedPoints(maxSegments);

                    const updateRibbon = (geo, yOffset) => {
                        const positions = geo.attributes.position.array;
                        for (let i = 0; i <= maxSegments; i++) {
                            const p = dynamicSpacedPoints[i];
                            const li = i * 2;
                            positions[li * 3 + 1] = p.y + yOffset;
                            positions[li * 3 + 2] = p.z;
                            positions[(li + 1) * 3 + 1] = p.y + yOffset;
                            positions[(li + 1) * 3 + 2] = p.z;
                        }
                        geo.attributes.position.needsUpdate = true;
                        geo.computeVertexNormals(); // Recompute normals so lighting stays smooth
                    };
                    updateRibbon(ribbonTopGeo, 0);
                    updateRibbon(ribbonBottomGeo, -stripThickness);

                    scrollOffset += tangentialSpeed * dt;

                    const fedFraction = fedLength / curveLength;
                    const activeSegments = Math.max(1, Math.min(maxSegments, Math.floor(fedFraction * maxSegments)));
                    ribbonTopGeo.setDrawRange(0, activeSegments * 6);
                    ribbonBottomGeo.setDrawRange(0, activeSegments * 6);

                    const uvShift = -(scrollOffset / 1.1) % 1;
                    stripTexTop.offset.x = uvShift;
                    stripTexBottom.offset.x = uvShift;

                    const feedRollOmega = tangentialSpeed / servoFeeder.rollRadius;
                    servoFeeder.lowerRoll.rotateY(-feedRollOmega * dt);
                    servoFeeder.upperRoll.rotateY(feedRollOmega * dt);
                    servoFeeder.feederCoupling.rotateY(-feedRollOmega * dt);
                    servoFeeder.feederMotor.rotateY(-feedRollOmega * 3 * dt);
                    servoFeeder.guideIn.rotateY(feedRollOmega * dt);
                    servoFeeder.guideOut.rotateY(-feedRollOmega * dt);



                    const growing = cutToLength.pieces[st.growingIndex];
                    if (bladePhase === 'idle') {
                        if (fedLength >= cutReachLength) {
                            lengthSinceCut = Math.min(pConfig.cutLength, lengthSinceCut + tangentialSpeed * dt);
                        }
                        const curLen = Math.max(lengthSinceCut, 0.001);
                        growing.scale.z = curLen;
                        growing.position.z = cutToLength.cutZ + curLen / 2;
                        growing.visible = true;
                        if (lengthSinceCut >= pConfig.cutLength &&
                            cutReadySheet === null &&
                            vacuumTransferSheet === null) {
                            bladePhase = 'descending';
                            bladeTimer = 0;
                        }
                    } else if (bladePhase === 'descending') {
                        bladeTimer += dt;
                        const t = Math.min(bladeTimer / 0.18, 1);
                        cutToLength.bladeHolder.position.y = THREE.MathUtils.lerp(cutToLength.holderTravelTop, cutToLength.holderTravelBottom, t);
                        if (t >= 1) {
                            bladePhase = 'holding';
                            bladeTimer = 0;
                        }
                    } else if (bladePhase === 'holding') {
                        bladeTimer += dt;
                        if (bladeTimer >= 0.12) {
                            let nextIndex = st.growingIndex;
                            for (let step = 1; step <= cutToLength.pieces.length; step++) {
                                const candidateIndex = (st.growingIndex + step) % cutToLength.pieces.length;
                                const candidate = cutToLength.pieces[candidateIndex];
                                if (!candidate.userData.onLowerDie && !candidate.userData.vacuumHeld && !candidate.userData.exitVacuumHeld && !candidate.userData.inContainer) {
                                    nextIndex = candidateIndex;
                                    break;
                                }
                            }
                            if (nextIndex === st.growingIndex) {
                                for (let step = 1; step <= cutToLength.pieces.length; step++) {
                                    const candidateIndex = (st.growingIndex + step) % cutToLength.pieces.length;
                                    const candidate = cutToLength.pieces[candidateIndex];
                                    if (!candidate.userData.onLowerDie && !candidate.userData.vacuumHeld && !candidate.userData.exitVacuumHeld) {
                                        nextIndex = candidateIndex;
                                        break;
                                    }
                                }
                            }
                            if (nextIndex !== st.growingIndex ||
                                (!cutToLength.pieces[nextIndex].userData.onLowerDie && !cutToLength.pieces[nextIndex].userData.vacuumHeld && !cutToLength.pieces[nextIndex].userData.exitVacuumHeld)) {
                                const finishedSheet = cutToLength.pieces[st.growingIndex];
                                finishedSheet.userData.cutReady = true;
                                finishedSheet.userData.onLowerDie = false;
                                finishedSheet.userData.vacuumHeld = false;
                                finishedSheet.userData.exitVacuumHeld = false;
                                finishedSheet.userData.inContainer = false;
                                cutReadySheet = finishedSheet;
                                st.totalPiecesCut++;

                                st.growingIndex = nextIndex;
                                const next = cutToLength.pieces[st.growingIndex];
                                const pos = next.geometry.attributes.position;
                                const base = next.userData.formBasePositions;
                                if (pos && base) {
                                    pos.array.set(base);
                                    pos.needsUpdate = true;
                                    next.geometry.computeVertexNormals();
                                }
                                next.material = cutToLength.pieceMat;
                                next.userData.onLowerDie = false;
                                next.userData.vacuumHeld = false;
                                next.userData.exitVacuumHeld = false;
                                next.userData.inContainer = false;
                                next.userData.cutReady = false;
                                next.userData.formed = false;
                                next.scale.z = 0.001;
                                next.position.set(0, cutToLength.pieceCenterY, cutToLength.cutZ);
                                next.visible = true;
                                lengthSinceCut = 0;
                            }
                            bladePhase = 'ascending';
                            bladeTimer = 0;
                        }
                    } else if (bladePhase === 'ascending') {
                        bladeTimer += dt;
                        const t = Math.min(bladeTimer / 0.22, 1);
                        cutToLength.bladeHolder.position.y = THREE.MathUtils.lerp(cutToLength.holderTravelBottom, cutToLength.holderTravelTop, t);
                        if (t >= 1) {
                            bladePhase = 'idle';
                            bladeTimer = 0;
                        }
                    }

                    cutToLength.pieces.forEach((mesh, idx) => {
                        if (idx === st.growingIndex || !mesh.visible) return;
                        if (mesh.userData.vacuumHeld || mesh.userData.onLowerDie || mesh.userData.cutReady || mesh.userData.exitVacuumHeld || mesh.userData.inContainer) return;
                        mesh.position.z += tangentialSpeed * dt;
                        if (mesh.position.z - mesh.scale.z / 2 > cutToLength.exitLimitZ) {
                            mesh.visible = false;
                        }
                    });

                    updateStampingPress(dt);
                    updateExitVacuumTransfer(dt);
                } // End of IDLE state block
            } // End of playing && < 10 block

            const now = performance.now();
            if (now - lastReportTime > 80 && onStatsUpdate) {
                lastReportTime = now;
                const totalProduced = st.totalProduced;
                const status = st.containerSwapState === 'WAITING_FOR_EMPTY'
                    ? 'CONTAINERS FULL'
                    : (!playingRef.current
                        ? 'STOPPED'
                        : (st.containerSwapState === 'SWAPPING' ? 'SWAPPING' : stampingState.toUpperCase()));

                const pendingParts = totalProduced - st.storedParts;
                const isActiveFull = st.exitContainerStackCount >= pConfig.capacity ? 1 : 0;
                const fullContainersCount = st.fullStorage.length + isActiveFull;

                onStatsUpdate({
                    rpm: playingRef.current ? currentRPM : 0,
                    feedRate: playingRef.current ? currentRPM * 2.827433 : 0,
                    pressStatus: status,
                    containerCount: totalProduced,
                    dashboardStats: {
                        totalContainers: pConfig.totalContainers,
                        fullContainers: fullContainersCount,
                        availableContainers: st.queue.length + 1,
                        containerCapacity: pConfig.capacity,
                        storedParts: st.storedParts,
                        pendingParts: pendingParts,
                        remainingStorageCapacity: ((st.queue.length + 1) * pConfig.capacity) - st.exitContainerStackCount,
                        estimatedAdditional: Math.floor(Math.max(0, 500.0 - ((st.totalPiecesCut * pConfig.cutLength) + fedLength + lengthSinceCut)) / pConfig.cutLength),
                        potentialTotalOutput: st.totalProduced + Math.floor(Math.max(0, 500.0 - ((st.totalPiecesCut * pConfig.cutLength) + fedLength + lengthSinceCut)) / pConfig.cutLength)
                    }
                });
            }

            renderer.render(scene, camera);
        }
        animate();

        /* ===================== CLEANUP ON UNMOUNT ===================== */
        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
            canvasEl.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointermove', onPointerMove);
            canvasEl.removeEventListener('wheel', onWheel);

            renderer.dispose();
            if (canvasEl.parentNode) {
                canvasEl.parentNode.removeChild(canvasEl);
            }
        };
    }, []);

    return <div id="scene-container" ref={containerRef} />;
}
