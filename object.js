"use strict";

var canvas;
var gl;
var program;

var projectionMatrix;
var modelViewMatrix;
var instanceMatrix;

var modelViewMatrixLoc;
var colorLoc;

var baseHeight = 3.0;
var baseWidth_bottom = 4.0;
var baseWidth_top = 2.0;
var baseDepth = 3.0;
var edgeThickness = 0.1;
var tabletopHeight = 0.2;

var w = edgeThickness / 2.0;
var h = 0.5;

var beamVertices = [
  vec4(-w, -h, w, 1.0),
  vec4(-w, h, w, 1.0),
  vec4(w, h, w, 1.0),
  vec4(w, -h, w, 1.0),
  vec4(-w, -h, -w, 1.0),
  vec4(-w, h, -w, 1.0),
  vec4(w, h, -w, 1.0),
  vec4(w, -h, -w, 1.0),
];

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

function degrees(radians) {
  return (radians * 180) / Math.PI;
}

var baseId = 0;
var tabletopId = 1;
var numNodes = 2;
var stack = [];
var figure = [];

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

  switch (Id) {
    case baseId:
      m = rotate(-90, vec3(1, 0, 0));
      figure[baseId] = createNode(m, baseRender, null, tabletopId);
      break;

    case tabletopId:
      var r = rotate(90, vec3(1, 0, 0));

      var railZ = -D_pos + w;
      var offsetZ = tabletopHeight / 2.0;
      var tabletopZ = railZ - offsetZ;

      var t = translate(0, 0, tabletopZ);

      m = mult(t, r);
      figure[tabletopId] = createNode(m, tabletopRender, null, null);
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
