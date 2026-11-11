"use strict";

const eyewearView = (() => {
  const three = window.THREE;
  const models = new Map();
  const rendered = new Map();
  const variants = {
    wayfarer: { profile: "wayfarer", frame: 0x181819, lens: 0x253d2f, roughness: .46, lensOpacity: .94, rim: .105 },
    tartaruga: { profile: "wayfarer", frame: 0xffffff, lens: 0xe8d5bc, roughness: .25, lensOpacity: .24, rim: .1, mottled: true },
    noir: { profile: "rectangular", frame: 0x202027, lens: 0x404653, roughness: .25, lensOpacity: .92, rim: .13 },
    cristal: { profile: "round", frame: 0xe6bd85, lens: 0xffedd6, roughness: .19, lensOpacity: .20, rim: .09, translucent: true },
    aviador: { profile: "aviator", frame: 0xd9a353, lens: 0x976238, roughness: .23, lensOpacity: .78, rim: .038, metal: true }
  };
  let renderer, scene, camera, templeMark, unavailable;

  function makeLighting() {
    const image = document.createElement("canvas");
    image.width = 512;
    image.height = 256;
    const paint = image.getContext("2d");
    const fill = paint.createLinearGradient(0, 0, 0, 256);
    fill.addColorStop(0, "#bbb1a5");
    fill.addColorStop(.53, "#403c37");
    fill.addColorStop(1, "#171616");
    paint.fillStyle = fill;
    paint.fillRect(0, 0, 512, 256);
    for (const [x, y, width, height, color] of [[15, 32, 154, 56, "#fff3e6"], [212, 56, 18, 116, "#eeeaff"], [329, 24, 122, 38, "#fffaf1"], [305, 98, 92, 50, "#c8885b"]]) {
      paint.fillStyle = color;
      paint.fillRect(x, y, width, height);
    }
    const texture = new three.CanvasTexture(image);
    texture.encoding = three.sRGBEncoding;
    texture.mapping = three.EquirectangularReflectionMapping;
    const processor = new three.PMREMGenerator(renderer);
    scene.environment = processor.fromEquirectangular(texture).texture;
    texture.dispose();
    processor.dispose();
  }

  function initialize() {
    if (unavailable || !three) return false;
    if (renderer) return true;

    try {
      renderer = new three.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.outputEncoding = three.sRGBEncoding;
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.addEventListener("webglcontextlost", event => {
        event.preventDefault();
        unavailable = true;
        rendered.forEach((view, canvas) => canvas.parentElement.classList.remove("is-live"));
      });
      renderer.domElement.addEventListener("webglcontextrestored", () => {
        unavailable = false;
        rendered.clear();
        window.dispatchEvent(new Event("resize"));
      });
      scene = new three.Scene();
      camera = new three.PerspectiveCamera(29, 1, .1, 35);
      scene.add(new three.HemisphereLight(0xfff8ee, 0x5d463b, 1.22));
      for (const [color, strength, position] of [[0xfff4e8, 1.7, [-5, 8, 7]], [0xc8dcff, .95, [7, 3, 4]], [0xffa35b, 1.55, [1, 4, -7]]]) {
        const light = new three.DirectionalLight(color, strength);
        light.position.set(...position);
        scene.add(light);
      }
      makeLighting();
      return true;
    } catch {
      unavailable = true;
      return false;
    }
  }

  function lensOutline(profile) {
    const shape = new three.Shape();
    if (profile === "aviator") {
      shape.moveTo(-.68, .36);
      shape.bezierCurveTo(-.44, .58, .47, .57, .69, .39);
      shape.bezierCurveTo(.9, .15, .61, -.59, .19, -.66);
      shape.bezierCurveTo(-.15, -.72, -.69, -.19, -.7, .08);
      shape.quadraticCurveTo(-.73, .27, -.68, .36);
    } else if (profile === "round") {
      shape.absellipse(0, 0, .7, .6, 0, Math.PI * 2, false, -.055);
    } else if (profile === "rectangular") {
      shape.moveTo(-.71, .36);
      shape.quadraticCurveTo(-.72, .48, -.57, .48);
      shape.lineTo(.62, .43);
      shape.quadraticCurveTo(.76, .42, .74, .28);
      shape.lineTo(.69, -.29);
      shape.quadraticCurveTo(.68, -.43, .49, -.44);
      shape.lineTo(-.50, -.43);
      shape.quadraticCurveTo(-.65, -.43, -.67, -.28);
      shape.closePath();
    } else {
      shape.moveTo(-.67, .34);
      shape.bezierCurveTo(-.55, .51, .43, .56, .73, .43);
      shape.bezierCurveTo(.80, .22, .67, -.35, .47, -.46);
      shape.bezierCurveTo(.21, -.59, -.31, -.54, -.48, -.43);
      shape.bezierCurveTo(-.63, -.32, -.76, .14, -.67, .34);
    }
    return shape;
  }

  function acetateMap() {
    const image = document.createElement("canvas");
    image.width = image.height = 256;
    const context = image.getContext("2d");
    context.fillStyle = "#a3531b";
    context.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 45; i++) {
      const x = i * 83 % 256;
      const y = i * 139 % 256;
      const radius = 9 + i * 17 % 33;
      const shade = context.createRadialGradient(x, y, 0, x, y, radius);
      shade.addColorStop(0, i % 4 === 0 ? "#eea448" : "#2a0d08");
      shade.addColorStop(.42, i % 4 === 0 ? "#b75b21" : "#3f170d");
      shade.addColorStop(1, "#57201300");
      context.fillStyle = shade;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    const map = new three.CanvasTexture(image);
    map.encoding = three.sRGBEncoding;
    map.wrapS = map.wrapT = three.RepeatWrapping;
    map.repeat.set(.66, .66);
    return map;
  }

  function roundedExtrusion(shape, depth, bevel) {
    return new three.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 24, steps: 1 });
  }

  function curvedLens(shape, tint) {
    const edges = shape.getSpacedPoints(56).slice(0, -1);
    const rings = 12;
    const positions = [];
    const indices = [];
    const colors = [];
    const topTint = new three.Color(0x442719).convertSRGBToLinear();
    const bottomTint = new three.Color(0xc89458).convertSRGBToLinear();
    for (let ring = 0; ring <= rings; ring++) {
      const radius = ring / rings;
      edges.forEach(({ x, y }, i) => {
        const height = y * radius;
        positions.push(x * radius, height, .035 + .12 * (1 - radius ** 2));
        if (tint) {
          const color = bottomTint.clone().lerp(topTint, three.MathUtils.clamp((height + .6) / 1.05, 0, 1));
          colors.push(color.r, color.g, color.b);
        }
        if (ring === rings) return;
        const point = ring * edges.length + i;
        const next = ring * edges.length + (i + 1) % edges.length;
        indices.push(point, next, point + edges.length, next, next + edges.length, point + edges.length);
      });
    }
    const geometry = new three.BufferGeometry();
    geometry.setAttribute("position", new three.Float32BufferAttribute(positions, 3));
    if (tint) geometry.setAttribute("color", new three.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function addTempleMark(parent, curve, radius, color) {
    if (!templeMark) {
      const image = document.createElement("canvas");
      image.width = 512;
      image.height = 112;
      const ink = image.getContext("2d");
      ink.font = "700 96px Arial, sans-serif";
      ink.textAlign = "center";
      ink.textBaseline = "middle";
      ink.fillStyle = "#fff";
      ink.fillText("CAETANO", 256, 60, 488);
      templeMark = new three.CanvasTexture(image);
      templeMark.encoding = three.sRGBEncoding;
    }

    const geometry = new three.PlaneGeometry(1, 1, 16, 4);
    const vertices = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const outward = new three.Vector3();
    const up = new three.Vector3();
    for (let i = 0; i < vertices.count; i++) {
      const step = .20 + uv.getX(i) * .27;
      const center = curve.getPointAt(step);
      const tangent = curve.getTangentAt(step);
      outward.set(1, 0, 0).addScaledVector(tangent, -tangent.x).normalize();
      up.crossVectors(outward, tangent);
      const angle = (uv.getY(i) - .5) * 1.12;
      const surface = radius * (1 - step * .41) + .002;
      outward.multiplyScalar(Math.cos(angle)).addScaledVector(up, Math.sin(angle));
      outward.y *= 1.66;
      center.addScaledVector(outward, surface);
      vertices.setXYZ(i, center.x, center.y, center.z);
    }
    const ink = new three.MeshBasicMaterial({ color, map: templeMark, alphaTest: .18, transparent: true, depthWrite: false, toneMapped: false });
    const mark = new three.Mesh(geometry, ink);
    mark.renderOrder = 1;
    parent.add(mark);
  }

  function tube(parent, points, radius, material, taper = false) {
    const curve = new three.CatmullRomCurve3(points.map(point => new three.Vector3(...point)));
    const segments = 36;
    const sides = 10;
    const geometry = new three.TubeGeometry(curve, segments, radius, sides, false);
    if (taper) {
      const vertices = geometry.attributes.position;
      for (let ring = 0; ring <= segments; ring++) {
        const step = ring / segments;
        const center = curve.getPointAt(step);
        for (let side = 0; side <= sides; side++) {
          const i = ring * (sides + 1) + side;
          const width = 1 - step * .41;
          vertices.setXYZ(i, center.x + (vertices.getX(i) - center.x) * width, center.y + (vertices.getY(i) - center.y) * width * 1.66, center.z + (vertices.getZ(i) - center.z) * width);
        }
      }
      geometry.computeVertexNormals();
      const tip = new three.Mesh(new three.SphereGeometry(radius * .59, 12, 8), material);
      tip.position.set(...points.at(-1));
      tip.scale.y = 1.66;
      parent.add(tip);
    }
    parent.add(new three.Mesh(geometry, material));
    return curve;
  }

  function buildModel(variant) {
    const model = new three.Group();
    const frame = new three.MeshPhysicalMaterial({ color: new three.Color(variant.frame).convertSRGBToLinear(), metalness: variant.metal ? .76 : .035, roughness: variant.roughness, clearcoat: .34, clearcoatRoughness: .24, envMapIntensity: .76, map: variant.mottled ? acetateMap() : null, transparent: !!variant.translucent, opacity: variant.translucent ? .78 : 1 });
    const hinge = new three.MeshStandardMaterial({ color: new three.Color(variant.metal ? 0xd2a057 : 0xc6c3ba).convertSRGBToLinear(), metalness: .82, roughness: .32 });
    const lens = new three.MeshPhysicalMaterial({ color: new three.Color(variant.metal ? 0xffffff : variant.lens).convertSRGBToLinear(), vertexColors: !!variant.metal, side: three.DoubleSide, roughness: .115, metalness: .19, clearcoat: 1, clearcoatRoughness: .09, transparent: true, opacity: variant.lensOpacity, depthWrite: variant.lensOpacity > .85 });
    const outline = lensOutline(variant.profile);
    const points = outline.getPoints(30);
    const ring = new three.Shape(points.map(point => new three.Vector2(point.x * (1 + variant.rim), point.y * (1 + variant.rim * 1.8))));
    ring.holes.push(new three.Path(points.slice().reverse()));
    const rim = roundedExtrusion(ring, variant.metal ? .045 : .119, variant.metal ? .012 : .033);
    const glass = curvedLens(outline, variant.metal);
    const lenses = [];

    for (const sign of [-1, 1]) {
      const half = new three.Group();
      half.position.set(sign * .91, 0, .58);
      half.rotation.y = sign * .08;
      half.scale.x = sign;
      half.add(new three.Mesh(rim, frame));
      const mount = new three.Group();
      const lensMesh = new three.Mesh(glass, lens);
      lensMesh.position.z = .039;
      mount.add(lensMesh);
      half.add(mount);
      lenses.push({ mount, sign });
      const rivet = new three.Mesh(new three.SphereGeometry(.044, 12, 8), hinge);
      rivet.scale.set(1.3, .55, .34);
      rivet.position.set(.79, .35, variant.metal ? .062 : .158);
      half.add(rivet);
      model.add(half);

      const radius = variant.metal ? .035 : .080;
      const temple = tube(model, [[sign * 1.68, .34, .62], [sign * 1.79, .34, .40], [sign * 1.86, .30, -.44], [sign * 1.8, .24, -1.28], [sign * 1.67, -.08, -1.90]], radius, frame, true);
      // Positive X is the wearer's left side when the lenses face forward.
      if (sign === 1) addTempleMark(model, temple, radius, variant.translucent || variant.metal ? 0x34201a : 0xffe2ae);
      const hardware = new three.Mesh(new three.BoxGeometry(.13, .12, .22), hinge);
      hardware.position.set(sign * 1.77, .31, .30);
      model.add(hardware);
    }

    tube(model, [[-.30, .21, .63], [-.15, .34, .67], [0, .37, .68], [.15, .34, .67], [.30, .21, .63]], variant.metal ? .031 : .083, frame);
    if (variant.metal) tube(model, [[-.52, .42, .60], [-.26, .54, .63], [0, .56, .65], [.26, .54, .63], [.52, .42, .60]], .029, frame);
    const { min, max } = new three.Box3().setFromObject(model);
    const corners = [];
    for (const x of [min.x, max.x]) {
      for (const y of [min.y, max.y]) {
        for (const z of [min.z, max.z]) corners.push(new three.Vector3(x, y, z));
      }
    }
    model.visible = false;
    scene.add(model);
    return { model, lenses, corners };
  }

  function frameCatalogModel(corners, rotation, verticalSlope) {
    const viewBounds = new three.Box3();
    const rotated = corners.map(corner => corner.clone().applyQuaternion(rotation));
    rotated.forEach(corner => viewBounds.expandByPoint(corner));
    const center = viewBounds.getCenter(new three.Vector3());
    const horizontalSlope = verticalSlope * camera.aspect;
    let cameraZ = -Infinity;
    // Fit each corner at its own depth so a temple pointing toward the camera stays in frame.
    for (const corner of rotated) {
      const fitX = Math.abs(corner.x - center.x) / (horizontalSlope * .86);
      const fitY = Math.abs(corner.y - center.y) / (verticalSlope * .82);
      cameraZ = Math.max(cameraZ, corner.z + Math.max(fitX, fitY));
    }
    camera.position.set(center.x, center.y, cameraZ);
    camera.lookAt(center);
  }

  function paint(canvas, name, yaw, pitch, separation = 0) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height || !initialize()) return false;

    const previous = rendered.get(canvas);
    if (previous && previous.width === width && previous.height === height && previous.yaw === yaw && previous.pitch === pitch && previous.separation === separation) return true;
    const resolution = Math.min(window.devicePixelRatio || 1, 1.5, 1500 / width);
    const viewWidth = Math.round(width * resolution);
    const viewHeight = Math.round(height * resolution);
    if (canvas.width !== viewWidth || canvas.height !== viewHeight) {
      canvas.width = viewWidth;
      canvas.height = viewHeight;
    }
    if (renderer.domElement.width !== viewWidth || renderer.domElement.height !== viewHeight) renderer.setSize(viewWidth, viewHeight, false);

    if (!models.has(name)) models.set(name, buildModel(variants[name]));
    const { model, lenses, corners } = models.get(name);
    model.visible = true;
    model.rotation.set(pitch, yaw, -.035);
    for (const { mount, sign } of lenses) {
      mount.position.set(separation * .79, separation * .66, separation * 1.11);
      mount.rotation.set(-separation * .18, sign * separation * .12, separation * -.11);
    }

    camera.aspect = width / height;
    const verticalSlope = Math.tan(three.MathUtils.degToRad(camera.fov / 2));
    if (name === "wayfarer") {
      const span = 5.65 + separation * 1.95;
      const heightNeeded = 2.38 + separation * .72;
      const distance = Math.max(heightNeeded, span / camera.aspect) / (2 * verticalSlope);
      camera.position.set(0, .42 + separation * .29, distance);
      camera.lookAt(0, separation * .22, -.33);
    } else {
      frameCatalogModel(corners, model.quaternion, verticalSlope);
    }
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    model.visible = false;

    const context = canvas.getContext("2d");
    context.clearRect(0, 0, viewWidth, viewHeight);
    context.drawImage(renderer.domElement, 0, 0);
    rendered.set(canvas, { width, height, yaw, pitch, separation });
    return true;
  }

  return { paint };
})();
