<script setup lang="ts">
import * as fabric from 'fabric'
import imgUrl from '@/assets/wallhaven.jpg'
import { onMounted } from 'vue'
onMounted(init)
type Mode = '放大' | '缩小' | '旋转' | '移动' | '画笔' | '撤销' | '重做'
let canvas: fabric.Canvas
let group: fabric.Group
let mode: Mode = '移动'
let isMoving = false
let history: fabric.Object[][] = []
let redoStack: fabric.Object[][] = []
let pencilBrush: fabric.PencilBrush
function setMode(newMode: Mode) {
  mode = newMode
  if (mode === '画笔') {
    canvas.isDrawingMode = true
  } else {
    canvas.isDrawingMode = false
  }
}

async function init() {
  canvas = new fabric.Canvas('canvas', {
    width: 800,
    height: 600,
    backgroundColor: 'white',
  })
  group = new fabric.Group([], {
    width: 800,
    height: 600,
  })
  pencilBrush = new fabric.PencilBrush(canvas)
  pencilBrush.color = 'red'
  pencilBrush.width = 10
  const img = await fabric.FabricImage.fromURL(imgUrl)
  const canvasAspect = canvas.width / canvas.height
  const imgAspect = img.width / img.height
  let scaleFactor

  if (canvasAspect > imgAspect) {
    // Image is taller relative to the canvas
    scaleFactor = canvas.height / img.height
  } else {
    // Image is wider relative to the canvas
    scaleFactor = canvas.width / img.width
  }

  // Scale the image
  img.scale(scaleFactor)

  // Center the image
  img.set({
    left: canvas.width / 2 - (img.width * scaleFactor) / 2,
    top: canvas.height / 2 - (img.height * scaleFactor) / 2,
  })
  img.lockMovementX = true
  img.lockMovementY = true
  img.hoverCursor = 'default'
  group.add(img)
  canvas.add(group)
  saveState()
  // 画布移动逻辑
  canvas.on('mouse:move', (opt) => {
    if (opt && opt.e && isMoving && mode === '移动') {
      const e = opt.e as any
      const vpt = canvas.viewportTransform!
      vpt[4] += e.movementX
      vpt[5] += e.movementY
      canvas.requestRenderAll()
    }
  })
  canvas.on('mouse:down', (opt) => {
    if (opt && opt.e && mode === '移动') {
      isMoving = true
    }
  })
  canvas.on('mouse:up', (opt) => {
    if (opt && opt.e && mode === '移动') {
      isMoving = false
    }
    if (mode === '画笔') {
      addPaths()
    }
  })

  function saveState() {
    console.log('saveState')
    history.push(canvas.toJSON())
    redoStack = []
  }
  function addPaths() {
    const paths: fabric.FabricObject[] = []
    canvas.getObjects('path').forEach(function (path) {
      paths.push(path)
    })
    if (group.getObjects().length === 0) {
      group.add(img)
    }
    group.add(...paths)
    canvas.clear()
    canvas.add(group)
    canvas.renderAll()
    saveState()
  }
  // canvas.on('object:added', saveState)
  // canvas.on('object:modified', saveState)
  // canvas.on('object:removed', saveState)
}
const currentMode = ref('放大')

function handleBrush(mode: Mode) {
  setMode(mode)
  canvas.isDrawingMode = true

  canvas.freeDrawingBrush = pencilBrush
}
function handleRotate(mode: Mode) {
  setMode(mode)
  group.rotate((group.angle || 0) + 45)
  // const objects = canvas.getObjects()
  // objects.forEach((obj) => {
  //   obj.rotate((obj.angle || 0) + 45)
  // })
  canvas.renderAll()
}
function handleZoomIn(mode: Mode) {
  setMode(mode)
  const centerX = canvas.getWidth() / 2
  const centerY = canvas.getHeight() / 2
  canvas.zoomToPoint(new fabric.Point({ x: centerX, y: centerY }), canvas.getZoom() * 1.1)
}
function handleZoomOut(mode: Mode) {
  setMode(mode)
  // set the zoom from the center of the canvas
  const centerX = canvas.getWidth() / 2
  const centerY = canvas.getHeight() / 2
  canvas.zoomToPoint(new fabric.Point({ x: centerX, y: centerY }), canvas.getZoom() * 0.9)
}
function handleMove(mode: Mode) {
  setMode(mode)
  canvas.isDrawingMode = false
  canvas.selection = false
  canvas.forEachObject((obj) => (obj.selectable = false))
  canvas.defaultCursor = 'move'
}
async function handleUndo(mode: Mode) {
  setMode(mode)
  if (history.length > 0) {
    redoStack.push(canvas.toJSON())
    group.remove(...group.getObjects())
    canvas.clear()
    console.log(history[history.length - 1])
    await canvas.loadFromJSON(history.pop()!)
    canvas.renderAll()
  }
}
function handleRedo(mode: Mode) {
  setMode(mode)
  if (redoStack.length > 0) {
    history.push(canvas.toJSON())
    canvas.clear()
    canvas.loadFromJSON(redoStack.pop()!, () => {
      canvas.renderAll()
    })
  }
}

const modes = ref<{ label: Mode; event: Function }[]>([
  {
    label: '放大',
    event: handleZoomIn,
  },
  {
    label: '缩小',
    event: handleZoomOut,
  },
  {
    label: '旋转',
    event: handleRotate,
  },
  {
    label: '移动',
    event: handleMove,
  },
  {
    label: '画笔',
    event: handleBrush,
  },
  {
    label: '撤销',
    event: handleUndo,
  },
  {
    label: '重做',
    event: handleRedo,
  },
])
</script>

<template>
  <div class="flex items-center flex-col gap-5 mt-3">
    <!-- <div> -->
    <canvas id="canvas" class="shadow-md"></canvas>
    <!-- </div> -->
    <n-space vertical>
      <n-radio-group v-model:value="currentMode">
        <n-radio-button
          v-for="mode in modes"
          :key="mode.label"
          @click="mode.event(mode.label)"
          :label="mode.label"
          :value="mode.label"
        ></n-radio-button>
      </n-radio-group>
      <n-button @click="handleUndo('撤销')">撤销</n-button>
    </n-space>
  </div>
</template>
