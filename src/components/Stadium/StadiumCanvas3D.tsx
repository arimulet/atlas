"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { StadiumData, StadiumStand, StandLocation } from "@/domain/stadium/types";
import { RotateCcw, Eye, Compass, Layers } from "lucide-react";

interface StadiumCanvas3DProps {
  stadium: StadiumData;
  selectedLocation?: StandLocation | null;
  onSelectStand?: (location: StandLocation) => void;
  showRoofs?: boolean;
  onReset?: () => void;
}

// --- Sokker Exact Mathematical Constants ---
const ND = 9;   // touchline/length margin
const TD = 7;   // goal line/width margin
const RD = 14;  // corner chamfer offset

// Stand seating tier parameters: width, depth, rise per seat
const STAND_SPECS: Record<number, { width: number; depth: number; rise: number }> = {
  0: { width: 0.5, depth: 0.5, rise: 0.12 },  // STANDING
  1: { width: 0.45, depth: 0.55, rise: 0.26 }, // TERRACES (Populares)
  2: { width: 0.48, depth: 0.75, rise: 0.36 }, // BENCHES (Gradas)
  3: { width: 0.5, depth: 0.8, rise: 0.42 }    // SEATS (Butacas)
};

const WALL_HEIGHT_FIRST = 1.1; // initial front wall height
const DEPTH_FIRST_ROW = 1.2;   // front walkway depth
const ROWS_PER_BREAK = 25;     // gangway aisle every 25 rows
const BREAK_DEPTH = 1.6;       // gangway walkway depth
const BREAK_RISE = 2.6;        // gangway riser height
const BACK_WALKWAY = 0.8;      // back safety walkway
const BACK_WALL_HEIGHT = 1.1;  // back safety wall height
const BACK_WALL_THICK = 0.3;   // back wall thickness
const LATERAL_MARGIN = 0.7;    // seat side margin
const MAX_ROWS = 200;

// Roof & column parameters
const ROOF_OVERHANG = -1.5;    // canopy front projection over field
const ROOF_CLEARANCE = 3.5;    // height of roof above stand top
const ROOF_SLOPE = 0.04;       // slight slope towards pitch
const ROOF_THICKNESS = 0.35;   // roof sandwich thickness
const PILLAR_SPACING = 12;     // max meters between rear pillars

// 2D Stadium Edge connecting two polygon vertices
class StadiumEdge {
  start: { x: number; z: number };
  end: { x: number; z: number };
  startMiter: { x: number; z: number };
  endMiter: { x: number; z: number };
  normal: { x: number; z: number };

  constructor(
    start: { x: number; z: number },
    end: { x: number; z: number },
    startMiter: { x: number; z: number },
    endMiter: { x: number; z: number },
    normal: { x: number; z: number }
  ) {
    this.start = start;
    this.end = end;
    this.startMiter = startMiter;
    this.endMiter = endMiter;
    this.normal = normal;
  }

  a(depth: number, lateralOffset = 0): { x: number; z: number } {
    return this.along(this.start, this.startMiter, depth, lateralOffset);
  }

  b(depth: number, lateralOffset = 0): { x: number; z: number } {
    return this.along(this.end, this.endMiter, depth, -lateralOffset);
  }

  length(depth: number): number {
    const pa = this.a(depth);
    const pb = this.b(depth);
    return Math.hypot(pb.x - pa.x, pb.z - pa.z);
  }

  along(
    point: { x: number; z: number },
    miter: { x: number; z: number },
    depth: number,
    lateralOffset: number
  ): { x: number; z: number } {
    const dx = this.end.x - this.start.x;
    const dz = this.end.z - this.start.z;
    const len = Math.hypot(dx, dz);
    return {
      x: point.x + miter.x * depth + (dx / len) * lateralOffset,
      z: point.z + miter.z * depth + (dz / len) * lateralOffset
    };
  }
}

// Computes the 8-sided octagon around the pitch matching Sokker
function getStadiumEdges(pitchLength: number, pitchWidth: number): Record<number, StadiumEdge> {
  const n = pitchLength / 2 + ND; // length half-span
  const r = pitchWidth / 2 + TD;  // width half-span
  const i = RD;

  // 8 vertices of the inner perimeter octagon around the pitch
  const poly = [
    { x: -n + i, z: -r },     // v0 (North-West inner)
    { x:  n - i, z: -r },     // v1 (North-East inner)
    { x:  n,     z: -r + i }, // v2 (East-North inner)
    { x:  n,     z:  r - i }, // v3 (East-South inner)
    { x:  n - i, z:  r },     // v4 (South-East inner)
    { x: -n + i, z:  r },     // v5 (South-West inner)
    { x: -n,     z:  r - i }, // v6 (West-South inner)
    { x: -n,     z: -r + i }  // v7 (West-North inner)
  ];

  // Stand locations matching Sokker's indexing: [1, 6, 4, 8, 2, 7, 3, 5]
  // 1: N, 6: NE, 4: E, 8: SE, 2: S, 7: SW, 3: W, 5: NW
  const locationOrder = [1, 6, 4, 8, 2, 7, 3, 5];

  // Outward normals for each edge
  const normals = poly.map((v, idx) => {
    const next = poly[(idx + 1) % poly.length]!;
    const dx = next.x - v.x;
    const dz = next.z - v.z;
    const len = Math.hypot(dx, dz);
    return { x: dz / len, z: -dx / len };
  });

  // Miter joint vectors
  function bisectMiter(v1: { x: number; z: number }, v2: { x: number; z: number }) {
    const dot = 1 + v1.x * v2.x + v1.z * v2.z;
    return { x: (v1.x + v2.x) / dot, z: (v1.z + v2.z) / dot };
  }

  const edgeMap: Record<number, StadiumEdge> = {};
  poly.forEach((v, idx) => {
    const nextIdx = (idx + 1) % poly.length;
    const prevIdx = (idx + poly.length - 1) % poly.length;
    const loc = locationOrder[idx]!;
    edgeMap[loc] = new StadiumEdge(
      v,
      poly[nextIdx]!,
      bisectMiter(normals[prevIdx]!, normals[idx]!),
      bisectMiter(normals[idx]!, normals[nextIdx]!),
      normals[idx]!
    );
  });

  return edgeMap;
}

// Procedural 3D Mesh Builder from 2D profile extrusion
class GeometryBuilder {
  edge: StadiumEdge;
  positions: number[] = [];

  constructor(edge: StadiumEdge) {
    this.edge = edge;
  }

  get empty(): boolean {
    return this.positions.length === 0;
  }

  triangle(
    p1: { x: number; z: number }, y1: number,
    p2: { x: number; z: number }, y2: number,
    p3: { x: number; z: number }, y3: number
  ) {
    this.positions.push(
      p1.x, y1, p1.z,
      p2.x, y2, p2.z,
      p3.x, y3, p3.z
    );
  }

  quad(
    p1: { x: number; z: number }, y1: number,
    p2: { x: number; z: number }, y2: number,
    p3: { x: number; z: number }, y3: number,
    p4: { x: number; z: number }, y4: number
  ) {
    this.triangle(p1, y1, p2, y2, p3, y3);
    this.triangle(p1, y1, p3, y3, p4, y4);
  }

  // Generates the stepped concrete stand body
  solid(profile: Array<[number, number]>) {
    for (let t = 1; t < profile.length; t++) {
      const [d0, h0] = profile[t - 1]!;
      const [d1, h1] = profile[t]!;

      // Top/riser surface quad
      this.quad(
        this.edge.a(d0), h0,
        this.edge.b(d0), h0,
        this.edge.b(d1), h1,
        this.edge.a(d1), h1
      );

      // Side lateral closing walls
      if (d0 !== d1) {
        this.quad(
          this.edge.a(d0), 0,
          this.edge.a(d0), h0,
          this.edge.a(d1), h1,
          this.edge.a(d1), 0
        );
        this.quad(
          this.edge.b(d0), 0,
          this.edge.b(d0), h0,
          this.edge.b(d1), h1,
          this.edge.b(d1), 0
        );
      }
    }
  }

  // Extrudes a horizontal beam (e.g. seat planks, backrests, canopy)
  beam(poly: Array<[number, number]>, margin = 0) {
    const na = poly.map(([d]) => this.edge.a(d, margin));
    const nb = poly.map(([d]) => this.edge.b(d, margin));

    for (let i = 0; i < poly.length; i++) {
      const next = (i + 1) % poly.length;
      this.quad(
        na[i]!, poly[i]![1],
        nb[i]!, poly[i]![1],
        nb[next]!, poly[next]![1],
        na[next]!, poly[next]![1]
      );
    }
    for (let i = 1; i < poly.length - 1; i++) {
      this.triangle(na[0]!, poly[0]![1], na[i]!, poly[i]![1], na[i + 1]!, poly[i + 1]![1]);
      this.triangle(nb[0]!, poly[0]![1], nb[i]!, poly[i]![1], nb[i + 1]!, poly[i + 1]![1]);
    }
  }

  // Vertical structural pillar/post
  post(fraction: number, dStart: number, dEnd: number, width: number, yMin: number, yMax: number) {
    const calc = (depth: number, lateral: number) => {
      const pa = this.edge.a(depth);
      const pb = this.edge.b(depth);
      const len = Math.hypot(pb.x - pa.x, pb.z - pa.z);
      const alpha = fraction + lateral / len;
      return {
        x: pa.x + (pb.x - pa.x) * alpha,
        z: pa.z + (pb.z - pa.z) * alpha
      };
    };

    const s = width / 2;
    const corners = [
      calc(dStart, -s),
      calc(dStart,  s),
      calc(dEnd,    s),
      calc(dEnd,   -s)
    ];

    for (let e = 0; e < 4; e++) {
      const p1 = corners[e]!;
      const p2 = corners[(e + 1) % 4]!;
      this.quad(p1, yMin, p2, yMin, p2, yMax, p1, yMax);
    }
    this.quad(corners[0]!, yMax, corners[1]!, yMax, corners[2]!, yMax, corners[3]!, yMax);
  }

  build(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geo.computeVertexNormals();
    return geo;
  }
}

// Stand Row Layout Calculator
interface StandLayout {
  rows: Array<{ depth: number; height: number; places: number }>;
  top: number;
  back: number;
  profile: Array<[number, number]>;
}

function calculateStandLayout(stand: StadiumStand, edge: StadiumEdge): StandLayout {
  const spec = STAND_SPECS[stand.type] || STAND_SPECS[3]!;
  const isStanding = stand.type === 1; // 1 = Terraces (standing)
  const { depth: r, rise: i, width: a } = spec;

  let depth = isStanding ? 0.5 : DEPTH_FIRST_ROW;
  let height = isStanding ? 0 : WALL_HEIGHT_FIRST;

  const profile: Array<[number, number]> = isStanding
    ? [[0, 0], [depth, 0]]
    : [[0, 0], [0, height], [depth, height]];

  let totalPlaces = 0;
  const rows: Array<{ depth: number; height: number; places: number }> = [];

  while (totalPlaces < stand.size && rows.length < MAX_ROWS) {
    if (rows.length > 0 && rows.length % ROWS_PER_BREAK === 0) {
      profile.push([depth, height + BREAK_RISE], [depth + BREAK_DEPTH, height + BREAK_RISE]);
      depth += BREAK_DEPTH;
      height += BREAK_RISE;
    }

    height += i;
    const availableWidth = edge.length(depth + r / 2) - 2 * LATERAL_MARGIN;
    const placesInRow = Math.max(1, Math.floor(availableWidth / a));
    const places = Math.min(placesInRow, stand.size - totalPlaces);

    rows.push({ depth, height, places });
    totalPlaces += placesInRow;

    if (isStanding) {
      profile.push([depth + r, height]);
    } else {
      profile.push([depth, height], [depth + r, height]);
    }
    depth += r;
  }

  depth += BACK_WALKWAY;
  profile.push([depth, height]);

  const top = height + (isStanding ? 0 : BACK_WALL_HEIGHT);
  profile.push([depth, top], [depth + BACK_WALL_THICK, top], [depth + BACK_WALL_THICK, 0]);

  const back = depth + BACK_WALL_THICK;
  return { rows, top, back, profile };
}

export function StadiumCanvas3D({
  stadium,
  selectedLocation = null,
  onSelectStand,
  showRoofs = true,
  onReset
}: StadiumCanvas3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const [activeRoofView, setActiveRoofView] = useState(showRoofs);
  const [selectedStand, setSelectedStand] = useState<StandLocation | null>(selectedLocation);

  useEffect(() => {
    setActiveRoofView(showRoofs);
  }, [showRoofs]);

  useEffect(() => {
    setSelectedStand(selectedLocation);
  }, [selectedLocation]);

  const setCameraView = useCallback((preset: "iso" | "side" | "goal" | "top") => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    controls.target.set(0, 10, 0);

    switch (preset) {
      case "iso":
        camera.position.set(135, 105, 135);
        break;
      case "side":
        camera.position.set(0, 55, 160);
        break;
      case "goal":
        camera.position.set(175, 55, 0);
        break;
      case "top":
        camera.position.set(0, 220, 0.1);
        break;
    }

    camera.lookAt(0, 10, 0);
    controls.update();
  }, []);

  const handleReset = useCallback(() => {
    setCameraView("iso");
    setActiveRoofView(true);
    if (onReset) {
      onReset();
    }
  }, [setCameraView, onReset]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // --- Scene & Renderer ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0c1322");
    scene.fog = new THREE.FogExp2("#0c1322", 0.002);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 900);
    camera.position.set(135, 105, 135);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.01;
    controls.minDistance = 25;
    controls.maxDistance = 500;
    controls.target.set(0, 10, 0);
    controlsRef.current = controls;

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight("#a0aec0", 0.9);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight("#ffffff", "#1e293b", 0.65);
    hemiLight.position.set(0, 120, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight("#fffbeb", 1.5);
    sunLight.position.set(90, 140, 80);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    sunLight.shadow.camera.left = -140;
    sunLight.shadow.camera.right = 140;
    sunLight.shadow.camera.top = 140;
    sunLight.shadow.camera.bottom = -140;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight("#93c5fd", 0.6);
    fillLight.position.set(-90, 100, -80);
    scene.add(fillLight);

    // --- Pitch Dimensions ---
    const pitchLength = stadium.pitch.length || 95;
    const pitchWidth = stadium.pitch.width || 72;

    // Ground Plane
    const groundGeo = new THREE.PlaneGeometry(360, 320);
    const groundMat = new THREE.MeshStandardMaterial({
      color: "#080c14",
      roughness: 0.95
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Apron surrounding pitch
    const apronGeo = new THREE.PlaneGeometry(pitchLength + 16, pitchWidth + 14);
    const apronMat = new THREE.MeshStandardMaterial({
      color: "#1e293b",
      roughness: 0.85
    });
    const apron = new THREE.Mesh(apronGeo, apronMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.05;
    apron.receiveShadow = true;
    scene.add(apron);

    // Dynamic High-Res Pitch Canvas Texture
    function createPitchTexture(): THREE.CanvasTexture {
      const cv = document.createElement("canvas");
      cv.width = 2048;
      cv.height = 1536;
      const ctx = cv.getContext("2d");
      if (!ctx) return new THREE.CanvasTexture(cv);

      ctx.fillStyle = "#15803d";
      ctx.fillRect(0, 0, cv.width, cv.height);

      const stripes = 18;
      const stripeW = cv.width / stripes;
      for (let s = 0; s < stripes; s++) {
        if (s % 2 === 0) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
          ctx.fillRect(s * stripeW, 0, stripeW, cv.height);
        }
      }

      const padX = 70;
      const padY = 70;
      const pw = cv.width - padX * 2;
      const ph = cv.height - padY * 2;
      const midX = cv.width / 2;
      const midY = cv.height / 2;

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 9;
      ctx.fillStyle = "#ffffff";

      // Boundary touchlines & goal lines
      ctx.strokeRect(padX, padY, pw, ph);

      // Halfway line
      ctx.beginPath();
      ctx.moveTo(midX, padY);
      ctx.lineTo(midX, padY + ph);
      ctx.stroke();

      // Center circle & spot
      const centerR = (9.15 / pitchLength) * pw;
      ctx.beginPath();
      ctx.arc(midX, midY, centerR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(midX, midY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Penalty areas
      const penDepth = (16.5 / pitchLength) * pw;
      const penWidth = (40.32 / pitchWidth) * ph;
      const penY = midY - penWidth / 2;
      const goalDepth = (5.5 / pitchLength) * pw;
      const goalWidth = (18.32 / pitchWidth) * ph;
      const goalY = midY - goalWidth / 2;

      // Left (West) Penalty box
      ctx.strokeRect(padX, penY, penDepth, penWidth);
      ctx.strokeRect(padX, goalY, goalDepth, goalWidth);
      const leftPenX = padX + (11 / pitchLength) * pw;
      ctx.beginPath();
      ctx.arc(leftPenX, midY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(leftPenX, midY, centerR, -0.92, 0.92);
      ctx.stroke();

      // Right (East) Penalty box
      ctx.strokeRect(padX + pw - penDepth, penY, penDepth, penWidth);
      ctx.strokeRect(padX + pw - goalDepth, goalY, goalDepth, goalWidth);
      const rightPenX = padX + pw - (11 / pitchLength) * pw;
      ctx.beginPath();
      ctx.arc(rightPenX, midY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rightPenX, midY, centerR, Math.PI - 0.92, Math.PI + 0.92);
      ctx.stroke();

      // Corner arcs
      const cornerR = (1 / pitchLength) * pw;
      const cornerArcs: Array<[number, number, number, number]> = [
        [padX, padY, 0, Math.PI / 2],
        [padX, padY + ph, -Math.PI / 2, 0],
        [padX + pw, padY, Math.PI / 2, Math.PI],
        [padX + pw, padY + ph, Math.PI, Math.PI * 1.5]
      ];
      cornerArcs.forEach(([x, y, sa, ea]) => {
        ctx.beginPath();
        ctx.arc(x, y, cornerR, sa, ea);
        ctx.stroke();
      });

      const tex = new THREE.CanvasTexture(cv);
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    }

    const pitchTex = createPitchTexture();
    const pitchGeo = new THREE.PlaneGeometry(pitchLength, pitchWidth);
    const pitchMat = new THREE.MeshStandardMaterial({
      map: pitchTex,
      roughness: 0.7
    });
    const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
    pitchMesh.rotation.x = -Math.PI / 2;
    pitchMesh.position.y = 0;
    pitchMesh.receiveShadow = true;
    scene.add(pitchMesh);

    // --- 3D Goals ---
    function createGoal(xPos: number, isLeft: boolean) {
      const goalGroup = new THREE.Group();
      const postMat = new THREE.MeshStandardMaterial({
        color: "#ffffff",
        metalness: 0.2,
        roughness: 0.3
      });

      const postRadius = 0.08;
      const postHeight = 2.44;
      const goalWidthM = 7.32;
      const goalDepthM = 2.0;
      const halfWidth = goalWidthM / 2;
      const dirX = isLeft ? -1 : 1; // Se proyecta hacia afuera/atrás de la línea de cal

      // 1. Marco frontal recto: 2 postes verticales + 1 travesaño horizontal
      const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 16);

      const postLeft = new THREE.Mesh(postGeo, postMat);
      postLeft.position.set(0, postHeight / 2, -halfWidth);
      postLeft.castShadow = true;

      const postRight = new THREE.Mesh(postGeo, postMat);
      postRight.position.set(0, postHeight / 2, halfWidth);
      postRight.castShadow = true;

      const crossbarGeo = new THREE.CylinderGeometry(postRadius, postRadius, goalWidthM + postRadius * 2, 16);
      const crossbar = new THREE.Mesh(crossbarGeo, postMat);
      crossbar.rotation.x = Math.PI / 2;
      crossbar.position.set(0, postHeight, 0);
      crossbar.castShadow = true;

      goalGroup.add(postLeft, postRight, crossbar);

      // 2. Estructura trasera recta (sin palos diagonales cruzados)
      const depthBarGeo = new THREE.CylinderGeometry(postRadius * 0.75, postRadius * 0.75, goalDepthM, 12);

      // Barras superiores de profundidad (izquierda y derecha)
      const topBarLeft = new THREE.Mesh(depthBarGeo, postMat);
      topBarLeft.rotation.z = Math.PI / 2;
      topBarLeft.position.set(dirX * (goalDepthM / 2), postHeight, -halfWidth);

      const topBarRight = new THREE.Mesh(depthBarGeo, postMat);
      topBarRight.rotation.z = Math.PI / 2;
      topBarRight.position.set(dirX * (goalDepthM / 2), postHeight, halfWidth);

      // Travesaño superior trasero
      const backTopBar = new THREE.Mesh(crossbarGeo, postMat);
      backTopBar.rotation.x = Math.PI / 2;
      backTopBar.position.set(dirX * goalDepthM, postHeight, 0);

      // Barras inferiores de suelo (izquierda y derecha)
      const groundBarLeft = new THREE.Mesh(depthBarGeo, postMat);
      groundBarLeft.rotation.z = Math.PI / 2;
      groundBarLeft.position.set(dirX * (goalDepthM / 2), postRadius, -halfWidth);

      const groundBarRight = new THREE.Mesh(depthBarGeo, postMat);
      groundBarRight.rotation.z = Math.PI / 2;
      groundBarRight.position.set(dirX * (goalDepthM / 2), postRadius, halfWidth);

      // Travesaño inferior trasero de suelo
      const backGroundBar = new THREE.Mesh(crossbarGeo, postMat);
      backGroundBar.rotation.x = Math.PI / 2;
      backGroundBar.position.set(dirX * goalDepthM, postRadius, 0);

      // Postes verticales traseros de apoyo
      const backPostLeft = new THREE.Mesh(postGeo, postMat);
      backPostLeft.position.set(dirX * goalDepthM, postHeight / 2, -halfWidth);

      const backPostRight = new THREE.Mesh(postGeo, postMat);
      backPostRight.position.set(dirX * goalDepthM, postHeight / 2, halfWidth);

      goalGroup.add(
        topBarLeft, topBarRight, backTopBar,
        groundBarLeft, groundBarRight, backGroundBar,
        backPostLeft, backPostRight
      );

      // 3. Red de portería cuadrangular (cubriendo fondo, techo y laterales; abierta hacia la cancha)
      const netTexCanvas = document.createElement("canvas");
      netTexCanvas.width = 64;
      netTexCanvas.height = 64;
      const netCtx = netTexCanvas.getContext("2d");
      if (netCtx) {
        netCtx.clearRect(0, 0, 64, 64);
        netCtx.strokeStyle = "rgba(255, 255, 255, 0.75)";
        netCtx.lineWidth = 4;
        netCtx.strokeRect(2, 2, 60, 60);
      }
      const netBaseTex = new THREE.CanvasTexture(netTexCanvas);
      netBaseTex.wrapS = THREE.RepeatWrapping;
      netBaseTex.wrapT = THREE.RepeatWrapping;

      const createNetPlaneMat = (repeatX: number, repeatY: number) => {
        const tex = netBaseTex.clone();
        tex.repeat.set(repeatX, repeatY);
        tex.needsUpdate = true;
        return new THREE.MeshStandardMaterial({
          map: tex,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
          depthWrite: false,
          roughness: 0.8
        });
      };

      // Cara trasera (fondo de la red)
      const backNetGeo = new THREE.PlaneGeometry(goalWidthM, postHeight);
      const backNetMesh = new THREE.Mesh(backNetGeo, createNetPlaneMat(16, 6));
      backNetMesh.position.set(dirX * goalDepthM, postHeight / 2, 0);
      backNetMesh.rotation.y = Math.PI / 2;
      goalGroup.add(backNetMesh);

      // Cara superior (techo de la red)
      const topNetGeo = new THREE.PlaneGeometry(goalDepthM, goalWidthM);
      const topNetMesh = new THREE.Mesh(topNetGeo, createNetPlaneMat(5, 16));
      topNetMesh.position.set(dirX * (goalDepthM / 2), postHeight, 0);
      topNetMesh.rotation.x = Math.PI / 2;
      goalGroup.add(topNetMesh);

      // Cara lateral izquierda
      const sideNetGeo = new THREE.PlaneGeometry(goalDepthM, postHeight);
      const leftNetMesh = new THREE.Mesh(sideNetGeo, createNetPlaneMat(5, 6));
      leftNetMesh.position.set(dirX * (goalDepthM / 2), postHeight / 2, -halfWidth);
      goalGroup.add(leftNetMesh);

      // Cara lateral derecha
      const rightNetMesh = new THREE.Mesh(sideNetGeo, createNetPlaneMat(5, 6));
      rightNetMesh.position.set(dirX * (goalDepthM / 2), postHeight / 2, halfWidth);
      goalGroup.add(rightNetMesh);

      // (El frente que da a la cancha permanece 100% abierto sin red)

      goalGroup.position.set(xPos, 0, 0);
      return goalGroup;
    }

    scene.add(createGoal(-pitchLength / 2, true));
    scene.add(createGoal(pitchLength / 2, false));

    // --- Generate 8 Stands with Exact Sokker Octagon Edge Engine ---
    const edgeMap = getStadiumEdges(pitchLength, pitchWidth);
    const standsParent = new THREE.Group();

    // Standard materials
    const concreteMat = new THREE.MeshStandardMaterial({
      color: "#475569",
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const terraceConcreteMat = new THREE.MeshStandardMaterial({
      color: "#cbd5e1",
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    const roofMat = new THREE.MeshStandardMaterial({
      color: "#f8fafc",
      roughness: 0.35,
      metalness: 0.45,
      side: THREE.DoubleSide
    });

    const fasciaMat = new THREE.MeshStandardMaterial({
      color: "#dc2626", // Red club trim on canopy edge
      roughness: 0.5,
      side: THREE.DoubleSide
    });

    const steelPillarMat = new THREE.MeshStandardMaterial({
      color: "#334155",
      metalness: 0.7,
      roughness: 0.3,
      side: THREE.DoubleSide
    });

    stadium.stands.forEach((stand) => {
      const edge = edgeMap[stand.location];
      if (!edge) return;

      const standGroup = new THREE.Group();
      const layout = calculateStandLayout(stand, edge);

      // 1. Stepped Concrete Body
      const concreteBuilder = new GeometryBuilder(edge);
      concreteBuilder.solid(layout.profile);
      const concreteGeo = concreteBuilder.build();
      const concreteMesh = new THREE.Mesh(concreteGeo, stand.type === 1 ? terraceConcreteMat : concreteMat);
      concreteMesh.castShadow = true;
      concreteMesh.receiveShadow = true;
      standGroup.add(concreteMesh);

      // 2. Seating Rows
      // Colors: Type 1 (Terraza/Populares) = Gris claro (#cbd5e1)
      //         Type 2 (Bancos/Gradas)     = Azul claro (#38bdf8)
      //         Type 3 (Asientos/Butacas)  = Rojo (#dc2626)
      const seatColor = stand.type === 1 ? "#cbd5e1" : stand.type === 2 ? "#38bdf8" : "#dc2626";
      const isSelected = selectedStand === stand.location;

      // La tribuna seleccionada se muestra con su mismo color pero más claro
      const baseColor = new THREE.Color(seatColor);
      const displayColor = isSelected ? baseColor.clone().lerp(new THREE.Color("#ffffff"), 0.45) : baseColor;

      const seatMat = new THREE.MeshStandardMaterial({
        color: displayColor,
        roughness: isSelected ? 0.35 : 0.6,
        metalness: 0.15,
        side: THREE.DoubleSide
      });

      if (isSelected) {
        seatMat.emissive = baseColor.clone().multiplyScalar(0.35);
      }

      const seatsBuilder = new GeometryBuilder(edge);
      for (const { depth: d, height: h } of layout.rows) {
        if (stand.type === 3) {
          // Seat cushion bench
          seatsBuilder.beam([
            [d + 0.22, h + 0.4],
            [d + 0.6,  h + 0.4],
            [d + 0.6,  h + 0.46],
            [d + 0.22, h + 0.46]
          ], LATERAL_MARGIN);
          // Seat backrest
          seatsBuilder.beam([
            [d + 0.6,  h + 0.4],
            [d + 0.66, h + 0.4],
            [d + 0.68, h + 0.85],
            [d + 0.62, h + 0.85]
          ], LATERAL_MARGIN);
        } else if (stand.type === 2) {
          // Benches
          seatsBuilder.beam([
            [d + 0.3, h + 0.38],
            [d + 0.62, h + 0.38],
            [d + 0.62, h + 0.44],
            [d + 0.3, h + 0.44]
          ], LATERAL_MARGIN);
        } else {
          // Terraces barriers
          seatsBuilder.beam([
            [d + 0.04, h + 0.9],
            [d + 0.1,  h + 0.9],
            [d + 0.1,  h + 0.96],
            [d + 0.04, h + 0.96]
          ], LATERAL_MARGIN);
        }
      }

      if (!seatsBuilder.empty) {
        const seatsGeo = seatsBuilder.build();
        const seatsMesh = new THREE.Mesh(seatsGeo, seatMat);
        seatsMesh.castShadow = true;
        seatsMesh.receiveShadow = true;
        standGroup.add(seatsMesh);
      }

      // 3. Cantilevered Roof Structure (if activeRoofView and stand.roof)
      if (activeRoofView && stand.roof) {
        const { back, top } = layout;
        const roofFront = ROOF_OVERHANG;
        const roofBackHeight = top + ROOF_CLEARANCE;
        const roofFrontHeight = roofBackHeight + ROOF_SLOPE * (back - roofFront);

        // Canopy roof plate
        const roofBuilder = new GeometryBuilder(edge);
        roofBuilder.beam([
          [roofFront, roofFrontHeight],
          [back,      roofBackHeight],
          [back,      roofBackHeight + ROOF_THICKNESS],
          [roofFront, roofFrontHeight + ROOF_THICKNESS]
        ], 0);
        const roofGeo = roofBuilder.build();
        const roofMesh = new THREE.Mesh(roofGeo, roofMat);
        roofMesh.castShadow = true;
        standGroup.add(roofMesh);

        // Front fascia trim
        const fasciaBuilder = new GeometryBuilder(edge);
        fasciaBuilder.beam([
          [roofFront - 0.15, roofFrontHeight - 0.8],
          [roofFront,        roofFrontHeight - 0.8],
          [roofFront,        roofFrontHeight + 0.45],
          [roofFront - 0.15, roofFrontHeight + 0.45]
        ], 0);
        const fasciaGeo = fasciaBuilder.build();
        const fasciaMesh = new THREE.Mesh(fasciaGeo, fasciaMat);
        standGroup.add(fasciaMesh);

        // Rear support pillars
        const pillarsBuilder = new GeometryBuilder(edge);
        const pillarCount = Math.max(2, Math.ceil(edge.length(back) / PILLAR_SPACING));
        for (let p = 0; p <= pillarCount; p++) {
          pillarsBuilder.post(
            0.02 + 0.96 * (p / pillarCount),
            back - 0.45,
            back - 0.05,
            0.4,
            0,
            roofBackHeight
          );
        }
        const pillarsGeo = pillarsBuilder.build();
        const pillarsMesh = new THREE.Mesh(pillarsGeo, steelPillarMat);
        pillarsMesh.castShadow = true;
        standGroup.add(pillarsMesh);
      }

      standGroup.userData = { location: stand.location, stand };
      standsParent.add(standGroup);
    });

    scene.add(standsParent);

    // --- 4 Floodlight Masts ---
    function createFloodlight(x: number, z: number) {
      const mastGroup = new THREE.Group();
      const mastH = 50;
      const mastMat = new THREE.MeshStandardMaterial({ color: "#64748b", metalness: 0.7, roughness: 0.3 });

      const mastGeo = new THREE.CylinderGeometry(0.6, 1.4, mastH, 8);
      const mast = new THREE.Mesh(mastGeo, mastMat);
      mast.position.y = mastH / 2;
      mast.castShadow = true;
      mastGroup.add(mast);

      const headGeo = new THREE.BoxGeometry(8, 5, 1.4);
      const head = new THREE.Mesh(headGeo, mastMat);
      head.position.set(0, mastH + 1, 0);
      head.lookAt(0, 10, 0);
      mastGroup.add(head);

      const bulbGeo = new THREE.PlaneGeometry(7.2, 4.2);
      const bulbMat = new THREE.MeshBasicMaterial({ color: "#fffbeb" });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(0, 0, 0.75);
      head.add(bulb);

      const spot = new THREE.SpotLight("#fff7ed", 0.95);
      spot.position.set(0, mastH + 1, 0);
      spot.target.position.set(0, 0, 0);
      spot.angle = 0.55;
      spot.penumbra = 0.45;
      mastGroup.add(spot);
      mastGroup.add(spot.target);

      mastGroup.position.set(x, 0, z);
      return mastGroup;
    }

    const maxSpanX = pitchLength / 2 + 65;
    const maxSpanZ = pitchWidth / 2 + 55;
    scene.add(createFloodlight(-maxSpanX, -maxSpanZ));
    scene.add(createFloodlight(+maxSpanX, -maxSpanZ));
    scene.add(createFloodlight(-maxSpanX, +maxSpanZ));
    scene.add(createFloodlight(+maxSpanX, +maxSpanZ));

    // --- Raycasting ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const dragThreshold = 5;
    const activePointers = new Set<number>();
    let pointerStart: { x: number; y: number; id: number } | null = null;
    let didDrag = false;

    const handlePointerDown = (event: PointerEvent) => {
      activePointers.add(event.pointerId);
      if (activePointers.size === 1) {
        pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
        didDrag = false;
      } else {
        didDrag = true;
      }
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (!pointerStart || event.pointerId !== pointerStart.id) return;
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > dragThreshold) {
        didDrag = true;
      }
    };
    const handlePointerEnd = (event: PointerEvent) => {
      activePointers.delete(event.pointerId);
      if (event.type === "pointercancel") didDrag = true;
      if (activePointers.size === 0) pointerStart = null;
    };

    const handleClick = (e: MouseEvent) => {
      if (didDrag) {
        didDrag = false;
        return;
      }
      if (!onSelectStand) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(standsParent.children, true);

      if (intersects.length > 0 && intersects[0]) {
        let curr: THREE.Object3D | null = intersects[0].object;
        while (curr && curr !== standsParent) {
          if (curr.userData?.location) {
            const loc = curr.userData.location as StandLocation;
            setSelectedStand(loc);
            onSelectStand(loc);
            break;
          }
          curr = curr.parent;
        }
      }
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    canvas.addEventListener("click", handleClick);

    // --- Render Loop ---
    let animId: number;
    let isMounted = true;

    const animate = () => {
      if (!isMounted) return;
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- Resize Observer ---
    const ro = new ResizeObserver((entries) => {
      const first = entries[0];
      if (!first) return;
      const { width: newW, height: newH } = first.contentRect;
      if (newW > 0 && newH > 0) {
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      }
    });
    ro.observe(container);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
      ro.disconnect();
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      controls.dispose();
      renderer.dispose();
      pitchTex.dispose();
    };
  }, [stadium, activeRoofView, selectedStand, onSelectStand]);

  return (
    <div className="stadium-3d-wrapper" ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", minHeight: "520px" }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%", outline: "none", cursor: "grab" }} />

      <div className="stadium-3d-toolbar" style={{
        position: "absolute",
        top: 16,
        right: 16,
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        zIndex: 10,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(8px)",
        padding: "6px 8px",
        borderRadius: "10px",
        border: "1px solid rgba(255, 255, 255, 0.1)"
      }}>
        <button
          type="button"
          onClick={() => setCameraView("iso")}
          title="Vista Diagonal / Isométrica"
          style={toolBtnStyle}
        >
          <Compass size={16} /> Isométrica
        </button>
        <button
          type="button"
          onClick={() => setCameraView("side")}
          title="Vista Lateral (Tribuna)"
          style={toolBtnStyle}
        >
          <Eye size={16} /> Lateral
        </button>
        <button
          type="button"
          onClick={() => setCameraView("goal")}
          title="Vista Detrás del Arco"
          style={toolBtnStyle}
        >
          <Eye size={16} /> Arco
        </button>
        <button
          type="button"
          onClick={() => setCameraView("top")}
          title="Vista Cenital / Aérea"
          style={toolBtnStyle}
        >
          <Eye size={16} /> Aérea
        </button>
        <button
          type="button"
          onClick={() => setActiveRoofView(!activeRoofView)}
          title="Mostrar / Ocultar Techos"
          style={{
            ...toolBtnStyle,
            backgroundColor: activeRoofView ? "rgba(59, 130, 246, 0.3)" : "transparent",
            borderColor: activeRoofView ? "#3b82f6" : "rgba(255, 255, 255, 0.15)"
          }}
        >
          <Layers size={16} /> {activeRoofView ? "Techos ON" : "Techos OFF"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          title="Restablecer valores y cámara originales"
          style={toolBtnStyle}
        >
          <RotateCcw size={16} /> Reset
        </button>
      </div>

      <div style={{
        position: "absolute",
        bottom: 12,
        left: 14,
        zIndex: 10,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        padding: "6px 12px",
        borderRadius: "8px",
        fontSize: "12px",
        color: "#94a3b8",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        pointerEvents: "none"
      }}>
        <span>🖱️ Arrastrar para rotar 360° · Rueda para zoom · Clic en grada para inspeccionar</span>
      </div>
    </div>
  );
}

const toolBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "5px 10px",
  fontSize: "12px",
  fontWeight: 500,
  color: "#f8fafc",
  backgroundColor: "rgba(30, 41, 59, 0.6)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "6px",
  cursor: "pointer",
  transition: "all 0.2s ease"
};
