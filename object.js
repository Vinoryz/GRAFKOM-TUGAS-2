"use strict";

var canvas;
var gl;
var program;

var projectionMatrix;
var modelViewMatrix;
var instanceMatrix;

var modelViewMatrixLoc;
var colorLoc;

// Ukuran-ukuran meja
var baseHeight = 3.0;
var baseWidth_bottom = 4.0;
var baseWidth_top = 2.0;
var baseDepth = 3.0;
var edgeThickness = 0.1; // Ketebalan kaki meja (frame besi)
var tabletopHeight = 0.2; // Ketebalan papan meja

var w = edgeThickness / 2.0;
var h = 0.5;

// Kerangka meja
var beamVertices = [
  vec4(-w, -h, w, 1.0),
  vec4(-w, h, w, 1.0),
  vec4(w, -h, w, 1.0),
  vec4(w, h, w, 1.0),
  vec4(-w, -h, -w, 1.0),
  vec4(-w, h, -w, 1.0),
  vec4(w, -h, -w, 1.0),
  vec4(w, h, -w, 1.0),
];

// Papan meja
var tabletopVertices = [
  vec4(-0.25, -0.5, 0.5, 1.0),
  vec4(-0.25, 0.5, 0.5, 1.0),
  vec4(0.25, 0.5, 0.5, 1.0),
  vec4(0.25, -0.5, 0.5, 1.0),
  vec4(-0.5, -0.5, -0.5, 1.0),
  vec4(-0.5, 0.5, -0.5, 1.0),
  vec4(0.5, 0.5, -0.5, 1.0),
  vec4(0.5, -0.5, -0.5, 1.0),
];

// Objek yang menggunakan unit cube di atas meja
var unitCubeVertices = [
  vec4(-0.5, -0.5, 0.5, 1.0),
  vec4(-0.5, 0.5, 0.5, 1.0),
  vec4(0.5, 0.5, 0.5, 1.0),
  vec4(0.5, -0.5, 0.5, 1.0),
  vec4(-0.5, -0.5, -0.5, 1.0),
  vec4(-0.5, 0.5, -0.5, 1.0),
  vec4(0.5, 0.5, -0.5, 1.0),
  vec4(0.5, -0.5, -0.5, 1.0),
];

// Variabel untuk menyimpan nilai kontrol dari slider
var controls = {
  tableTX: 0,
  tableTY: 0,
  tableTZ: 0,
  tableRY: 0,
  penTX: 0,
  penTY: 0,
  penTZ: 0,
  penRY: 0,
  markerTX: 0,
  markerTY: 0,
  markerTZ: 0,
  markerRZ: 0,
};

// Konversi radian ke derajat (digunakan untuk rotasi)
function degrees(radians) {
  return (radians * 180) / Math.PI;
}

// Konstanta indeks
var baseId = 0;
var tabletopId = 1;
var penHolderId = 2;
var remoteId = 3;
var markerRedId = 4;
var markerBlueId = 5;
var markerBlackId = 6;
var markerGreenId = 7;

var numNodes = 8; // Jumlah objek (base, tabletop, penHolder, remote, markerRed, markerBlue, markerBlack, markerGreen)
var stack = [];
var figure = [];

// inisiasi node
for (var i = 0; i < numNodes; i++)
  figure[i] = createNode(null, null, null, null);

var vBuffer;
var pointsArray = [];

var isDragging = false;
var lastMouseX = -1;
var lastMouseY = -1;
var radius = 20.0;
var theta = 0.0;
var phi = 0.5;
var sensitivity = 0.01;

// Membuat objek untuk node
function createNode(transform, render, sibling, child) {
  var node = {
    transform: transform,
    render: render,
    sibling: sibling,
    child: child,
  };
  return node;
}

function initNodes(Id) {
  var m = mat4();
  var D_pos = baseDepth / 2.0;
  var t;

  var m_default, m_translate, m_rotate;

  switch (Id) {
    case baseId:
      m_default = rotate(-90, vec3(1, 0, 0));
      m_translate = translate(
        controls.tableTX,
        controls.tableTY,
        controls.tableTZ
      );
      m_rotate = rotate(controls.tableRY, vec3(0, 1, 0));
      m = mult(m_translate, mult(m_rotate, m_default));
      figure[baseId] = createNode(m, baseRender, null, tabletopId);
      break;

    case tabletopId:
      var r = rotate(90, vec3(1, 0, 0));
      var railZ = -D_pos + w;
      var offsetZ = tabletopHeight / 2.0;
      var tabletopZ = railZ - offsetZ;
      t = translate(0, 0, tabletopZ);
      m = mult(t, r);
      figure[tabletopId] = createNode(m, tabletopRender, null, penHolderId);
      break;

    case penHolderId:
      m_default = translate(1.0, tabletopHeight / 2.0 + 0.5, 0.5);

      m_translate = translate(controls.penTX, controls.penTY, controls.penTZ);
      m_rotate = rotate(controls.penRY, vec3(0, 1, 0));
      m = mult(m_default, mult(m_translate, m_rotate));

      figure[penHolderId] = createNode(
        m,
        penHolderRender,
        remoteId,
        markerRedId
      );
      break;

    case remoteId:
      t = translate(-1.0, tabletopHeight / 2.0 + 0.1, 0.5);
      figure[remoteId] = createNode(t, remoteRender, null, null);
      break;

    case markerRedId:
      m_default = translate(0.1, 0.35, 0.1);

      m_translate = translate(
        controls.markerTX,
        controls.markerTY,
        controls.markerTZ
      );
      m_rotate = rotate(controls.markerRZ, vec3(0, 0, 1));
      m = mult(m_default, mult(m_translate, m_rotate));

      figure[markerRedId] = createNode(m, markerRedRender, markerBlueId, null);
      break;

    case markerBlueId:
      t = translate(-0.1, 0.35, 0.1);
      figure[markerBlueId] = createNode(
        t,
        markerBlueRender,
        markerBlackId,
        null
      );
      break;

    case markerBlackId:
      t = translate(0.1, 0.35, -0.1);
      figure[markerBlackId] = createNode(
        t,
        markerBlackRender,
        markerGreenId,
        null
      );
      break;

    case markerGreenId:
      t = translate(-0.1, 0.35, -0.1);
      figure[markerGreenId] = createNode(t, markerGreenRender, null, null);
      break;
  }
}

function traverse(Id) {
  if (Id == null) return;
  stack.push(modelViewMatrix);
  modelViewMatrix = mult(modelViewMatrix, figure[Id].transform);
  figure[Id].render();
  if (figure[Id].child != null) traverse(figure[Id].child);
  modelViewMatrix = stack.pop();
  if (figure[Id].sibling != null) traverse(figure[Id].sibling);
}

function drawEdge(transformMatrix) {
  gl.uniform4fv(colorLoc, vec4(0.0, 0.0, 0.0, 1.0));
  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(transformMatrix));

  for (var i = 0; i < 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 4 * i, 4);
}

function baseRender() {
  var H_pos = baseHeight / 2.0;
  var W_pos_b = baseWidth_bottom / 2.0;
  var W_pos_t = baseWidth_top / 2.0;
  var D_pos = baseDepth / 2.0;
  var s, t, r;
  var m;

  r = rotate(90, vec3(0, 0, 1));

  s = scale(1.0, baseWidth_top - edgeThickness, 1.0);
  t = translate(0, H_pos - w, -D_pos + w);
  m = mult(t, mult(r, s));
  drawEdge(mult(modelViewMatrix, m));

  t = translate(0, H_pos - w, D_pos - w);
  m = mult(t, mult(r, s));
  drawEdge(mult(modelViewMatrix, m));

  s = scale(1.0, baseWidth_bottom - edgeThickness, 1.0);
  t = translate(0, -H_pos + w, -D_pos + w);
  m = mult(t, mult(r, s));
  drawEdge(mult(modelViewMatrix, m));

  s = scale(1.0, baseDepth - edgeThickness, 1.0);
  r = rotate(90, vec3(1, 0, 0));

  t = translate(-W_pos_t + w, H_pos - w, 0);
  m = mult(t, mult(r, s));
  drawEdge(mult(modelViewMatrix, m));

  t = translate(W_pos_t - w, H_pos - w, 0);
  m = mult(t, mult(r, s));
  drawEdge(mult(modelViewMatrix, m));

  t = translate(-W_pos_b + w, -H_pos + w, 0);
  m = mult(t, mult(r, s));
  drawEdge(mult(modelViewMatrix, m));

  t = translate(W_pos_b - w, -H_pos + w, 0);
  m = mult(t, mult(r, s));
  drawEdge(mult(modelViewMatrix, m));

  var run = W_pos_b - W_pos_t;
  var rise = baseHeight - edgeThickness;
  var postLength = Math.sqrt(run * run + rise * rise);
  var angle = degrees(Math.atan(run / rise));
  s = scale(1.0, postLength, 1.0);

  t = translate(-(W_pos_t + W_pos_b) / 2 + w, 0, -D_pos + w);
  r = rotate(angle, vec3(0, 0, 1));
  m = mult(t, mult(r, s));
  drawEdge(mult(modelViewMatrix, m));

  t = translate(-(W_pos_t + W_pos_b) / 2 + w, 0, D_pos - w);
  r = rotate(angle, vec3(0, 0, 1));
  m = mult(t, mult(r, s));
  drawEdge(mult(modelViewMatrix, m));

  t = translate((W_pos_t + W_pos_b) / 2 - w, 0, -D_pos + w);
  r = rotate(-angle, vec3(0, 0, 1));
  m = mult(t, mult(r, s));
  drawEdge(mult(modelViewMatrix, m));

  t = translate((W_pos_t + W_pos_b) / 2 - w, 0, D_pos - w);
  r = rotate(-angle, vec3(0, 0, 1));
  m = mult(t, mult(r, s));
  drawEdge(mult(modelViewMatrix, m));
}

function tabletopRender() {
  gl.uniform4fv(colorLoc, vec4(0.92, 0.87, 0.78, 1.0));
  var tabletopWidth = baseWidth_top + 3.5;
  var tabletopDepth = baseHeight + 1.5;
  instanceMatrix = mult(
    modelViewMatrix,
    scale(tabletopWidth, tabletopHeight, tabletopDepth)
  );
  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix));

  for (var i = 0; i < 6; i++) {
    gl.drawArrays(gl.TRIANGLE_FAN, 24 + 4 * i, 4);
  }
}

function penHolderRender() {
  gl.uniform4fv(colorLoc, vec4(0.2, 0.2, 0.2, 1.0));
  instanceMatrix = mult(modelViewMatrix, scale(0.5, 1.0, 0.5));
  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix));
  for (var i = 0; i < 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 48 + 4 * i, 4);
}

function remoteRender() {
  gl.uniform4fv(colorLoc, vec4(0.1, 0.1, 0.1, 1.0));
  instanceMatrix = mult(modelViewMatrix, scale(0.4, 0.2, 1.2));
  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix));
  for (var i = 0; i < 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 48 + 4 * i, 4);
}

function markerRedRender() {
  gl.uniform4fv(colorLoc, vec4(1.0, 0.0, 0.0, 1.0));
  instanceMatrix = mult(modelViewMatrix, scale(0.1, 1.5, 0.1));
  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix));
  for (var i = 0; i < 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 48 + 4 * i, 4);
}

function markerBlueRender() {
  gl.uniform4fv(colorLoc, vec4(0.0, 0.0, 1.0, 1.0));
  instanceMatrix = mult(modelViewMatrix, scale(0.1, 1.5, 0.1));
  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix));
  for (var i = 0; i < 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 48 + 4 * i, 4);
}

function markerBlackRender() {
  gl.uniform4fv(colorLoc, vec4(0.0, 0.0, 0.0, 1.0));
  instanceMatrix = mult(modelViewMatrix, scale(0.1, 1.5, 0.1));
  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix));
  for (var i = 0; i < 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 48 + 4 * i, 4);
}

function markerGreenRender() {
  gl.uniform4fv(colorLoc, vec4(0.0, 1.0, 0.0, 1.0));
  instanceMatrix = mult(modelViewMatrix, scale(0.1, 1.5, 0.1));
  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix));
  for (var i = 0; i < 6; i++) gl.drawArrays(gl.TRIANGLE_FAN, 48 + 4 * i, 4);
}

function quad(vertexArray, a, b, c, d) {
  pointsArray.push(vertexArray[a]);
  pointsArray.push(vertexArray[b]);
  pointsArray.push(vertexArray[c]);
  pointsArray.push(vertexArray[d]);
}

function createBeamGeometry() {
  quad(beamVertices, 1, 0, 3, 2);
  quad(beamVertices, 2, 3, 7, 6);
  quad(beamVertices, 3, 0, 4, 7);
  quad(beamVertices, 6, 5, 1, 2);
  quad(beamVertices, 4, 5, 6, 7);
  quad(beamVertices, 5, 4, 0, 1);
}

function createTabletopGeometry() {
  quad(tabletopVertices, 1, 0, 3, 2);
  quad(tabletopVertices, 2, 3, 7, 6);
  quad(tabletopVertices, 3, 0, 4, 7);
  quad(tabletopVertices, 6, 5, 1, 2);
  quad(tabletopVertices, 4, 5, 6, 7);
  quad(tabletopVertices, 5, 4, 0, 1);
}

function createCubeGeometry() {
  quad(unitCubeVertices, 1, 0, 3, 2);
  quad(unitCubeVertices, 2, 3, 7, 6);
  quad(unitCubeVertices, 3, 0, 4, 7);
  quad(unitCubeVertices, 6, 5, 1, 2);
  quad(unitCubeVertices, 4, 5, 6, 7);
  quad(unitCubeVertices, 5, 4, 0, 1);
}

window.onload = function init() {
  canvas = document.getElementById("gl-canvas");

  gl = canvas.getContext("webgl2");
  if (!gl) {
    alert("WebGL 2.0 isn't available");
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  gl.enable(gl.DEPTH_TEST);

  program = initShaders(gl, "vertex-shader", "fragment-shader");
  gl.useProgram(program);

  createBeamGeometry();
  createTabletopGeometry();
  createCubeGeometry();

  vBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW);

  var positionLoc = gl.getAttribLocation(program, "aPosition");
  gl.vertexAttribPointer(positionLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(positionLoc);

  modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
  colorLoc = gl.getUniformLocation(program, "uColor");

  projectionMatrix = perspective(45, canvas.width / canvas.height, 0.1, 100.0);
  gl.uniformMatrix4fv(
    gl.getUniformLocation(program, "projectionMatrix"),
    false,
    flatten(projectionMatrix)
  );

  function updateTransforms() {
    for (var i = 0; i < numNodes; i++) initNodes(i);
  }

  document.getElementById("sliderTableTX").oninput = function (event) {
    controls.tableTX = parseFloat(event.target.value);
    updateTransforms();
  };
  document.getElementById("sliderTableTY").oninput = function (event) {
    controls.tableTY = parseFloat(event.target.value);
    updateTransforms();
  };
  document.getElementById("sliderTableTZ").oninput = function (event) {
    controls.tableTZ = parseFloat(event.target.value);
    updateTransforms();
  };
  document.getElementById("sliderTableRY").oninput = function (event) {
    controls.tableRY = parseFloat(event.target.value);
    updateTransforms();
  };

  document.getElementById("sliderPenTX").oninput = function (event) {
    controls.penTX = parseFloat(event.target.value);
    updateTransforms();
  };
  document.getElementById("sliderPenTY").oninput = function (event) {
    controls.penTY = parseFloat(event.target.value);
    updateTransforms();
  };
  document.getElementById("sliderPenTZ").oninput = function (event) {
    controls.penTZ = parseFloat(event.target.value);
    updateTransforms();
  };
  document.getElementById("sliderPenRY").oninput = function (event) {
    controls.penRY = parseFloat(event.target.value);
    updateTransforms();
  };

  document.getElementById("sliderMarkerTX").oninput = function (event) {
    controls.markerTX = parseFloat(event.target.value);
    updateTransforms();
  };
  document.getElementById("sliderMarkerTY").oninput = function (event) {
    controls.markerTY = parseFloat(event.target.value);
    updateTransforms();
  };
  document.getElementById("sliderMarkerTZ").oninput = function (event) {
    controls.markerTZ = parseFloat(event.target.value);
    updateTransforms();
  };
  document.getElementById("sliderMarkerRZ").oninput = function (event) {
    controls.markerRZ = parseFloat(event.target.value);
    updateTransforms();
  };

  canvas.onmousedown = function (event) {
    isDragging = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
  };
  canvas.onmouseup = function (event) {
    isDragging = false;
  };
  canvas.onmousemove = function (event) {
    if (isDragging) {
      var newX = event.clientX;
      var newY = event.clientY;
      var deltaX = newX - lastMouseX;
      var deltaY = newY - lastMouseY;

      theta -= deltaX * sensitivity;
      phi -= deltaY * sensitivity;

      var piOver2 = Math.PI / 2.0;
      if (phi > piOver2 - 0.1) phi = piOver2 - 0.1;
      if (phi < -piOver2 + 0.1) phi = -piOver2 + 0.1;

      lastMouseX = newX;
      lastMouseY = newY;
    }
  };

  for (var i = 0; i < numNodes; i++) initNodes(i);

  render();
};

// menghitung MV matrix dan menggambar objek
function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var eyeX = radius * Math.cos(phi) * Math.sin(theta);
  var eyeY = radius * Math.sin(phi);
  var eyeZ = radius * Math.cos(phi) * Math.cos(theta);

  modelViewMatrix = lookAt(
    vec3(eyeX, eyeY, eyeZ),
    vec3(0, 0, 0),
    vec3(0, 1, 0)
  );

  traverse(baseId);

  requestAnimationFrame(render);
}
