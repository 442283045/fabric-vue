<script setup lang="ts">
import * as fabric from 'fabric'
import imgUrl from '@/assets/wallhaven.jpg'
import { onMounted } from 'vue'
onMounted(init)
type Mode = '选择' | '移动' | '画笔'
let canvas: fabric.Canvas
let mode: Mode = '选择'
let isMoving = false
let history: string[] = []
let redoStack: string[] = []
let pencilBrush: fabric.PencilBrush
let currentEditImg: fabric.FabricImage
let dirty = false // 是否有未保存的更改

const canvasZoomRatio = ref(100)

function setMode(newMode: Mode) {
  mode = newMode
  if (mode === '画笔') {
    canvas.isDrawingMode = true
  } else {
    canvas.isDrawingMode = false
  }
}
// 初始化图片
async function initImage() {
  currentEditImg = await fabric.FabricImage.fromURL(imgUrl)
  const canvasAspect = canvas.width / canvas.height
  const imgAspect = currentEditImg.width / currentEditImg.height
  let scaleFactor

  if (canvasAspect > imgAspect) {
    scaleFactor = canvas.height / currentEditImg.height
  } else {
    scaleFactor = canvas.width / currentEditImg.width
  }

  currentEditImg.scale(scaleFactor)

  currentEditImg.set({
    left: canvas.width / 2 - (currentEditImg.width * scaleFactor) / 2,
    top: canvas.height / 2 - (currentEditImg.height * scaleFactor) / 2,
  })
  currentEditImg.hoverCursor = 'default'
}
function initBrush() {
  pencilBrush = new fabric.PencilBrush(canvas)
  pencilBrush.color = 'red'
  pencilBrush.width = 3
}
function initEventListener() {
  // 画布移动相关事件
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

    if (mode === '画笔' && dirty === true) {
      saveState()
    }
  })
  canvas.on('mouse:up', (opt) => {
    if (opt && opt.e && mode === '移动') {
      isMoving = false
    }
    // 画笔模式下，将画笔绘制的路径添加到group中
    if (mode === '画笔') {
      dirty = true
    }
  })

  // 画布缩放相关事件
  canvas.on('mouse:wheel', (opt) => {
    const delta = opt.e.deltaY
    const direction = delta > 0 ? -1 : 1

    canvas.zoomToPoint(
      new fabric.Point(opt.e.offsetX, opt.e.offsetY),
      canvas.getZoom() + direction * 0.1,
    )
    canvasZoomRatio.value = Math.round(canvas.getZoom() * 100)
    opt.e.preventDefault()
    opt.e.stopPropagation()
  })
}
// 保存画布状态
function saveState(resetRedo = true) {
  history.push(canvas.toJSON())
  if (resetRedo) {
    redoStack = []
  }
  console.log('state saved', history)
}

// 撤销
async function handleUndo() {
  if (history.length === 1) {
    await canvas.loadFromJSON(history[0])
  }
  if (history.length > 1) {
    if (dirty === true) {
      saveState(false)
      redoStack.push(history.pop()!)
      await canvas.loadFromJSON(history.pop()!)
    } else {
      const currentState = history.pop()!
      redoStack.push(currentState)
      await canvas.loadFromJSON(currentState)
    }
  }
  canvas.renderAll()

  console.log('undo', history)
  console.log('redo', redoStack)
}
// 重做
async function handleRedo() {
  if (redoStack.length > 0) {
    const redoState = redoStack.pop()!
    if (dirty === true) {
      saveState(false)
    }
    await canvas.loadFromJSON(redoState)
    canvas.renderAll()
  }
  console.log('redo', redoStack)
}

async function init() {
  canvas = new fabric.Canvas('canvas', {
    width: 800,
    height: 600,
    backgroundColor: 'rgb(245, 245, 245)',
  })
  canvas.preserveObjectStacking = true // 在选择时保持对象的堆叠顺序

  initBrush()
  await initImage()

  canvas.add(currentEditImg)
  saveState()
  // 画布移动逻辑
  initEventListener()

  // canvas.on('object:added', saveState)
  // canvas.on('object:modified', saveState)
  // canvas.on('object:removed', saveState)
}
let currentMode = ref<Mode>('选择')

function handleRotate(direction: 'left' | 'right') {
  // 旋转整个画布(将所有对象放入一个group中，然后旋转group)
  const group = new fabric.Group([], {
    width: canvas.width,
    height: canvas.height,
  })
  group.add(...canvas.getObjects())
  canvas.add(group)
  group.rotate((group.angle || 0) + (direction === 'left' ? -90 : 90))
  canvas.renderAll()
  // 旋转之后，将group中的对象重新放回画布
  canvas.add(...group.getObjects())
  canvas.renderAll()
}
function handleZoomIn() {
  const centerX = canvas.getWidth() / 2
  const centerY = canvas.getHeight() / 2
  canvas.zoomToPoint(new fabric.Point({ x: centerX, y: centerY }), canvas.getZoom() + 0.1)
  canvasZoomRatio.value = Math.round(canvas.getZoom() * 100)
}
function handleZoomOut() {
  const centerX = canvas.getWidth() / 2
  const centerY = canvas.getHeight() / 2
  canvas.zoomToPoint(new fabric.Point({ x: centerX, y: centerY }), canvas.getZoom() - 0.1)
  canvasZoomRatio.value = Math.round(canvas.getZoom() * 100)
}

// 切换编辑模式
function toggleMode(mode: Mode) {
  currentMode.value = mode
  // 重置所有状态
  canvas.isDrawingMode = false // 关闭画笔模式
  canvas.selection = false // 关闭选择模式
  canvas.forEachObject((obj) => {
    obj.selectable = false // 关闭对象选择
    obj.hoverCursor = 'default'
  })

  canvas.defaultCursor = 'default'
  canvas.discardActiveObject()
  setMode(mode)
  switch (mode) {
    case '选择':
      handleSelect()
      break
    case '移动':
      handleMove()
      break
    case '画笔':
      handleBrush()
      break
  }
  canvas.renderAll()
}

// 选择模式
function handleSelect() {
  canvas.isDrawingMode = false
  canvas.selection = true
  canvas.forEachObject((obj) => (obj.selectable = true))
  canvas.defaultCursor = 'default'
}
// 画笔模式
function handleBrush() {
  canvas.isDrawingMode = true

  canvas.freeDrawingBrush = pencilBrush
}
// 移动模式：对整个画布进行移动
function handleMove() {
  canvas.forEachObject((obj) => {
    obj.hoverCursor = 'grab'
  })
  canvas.defaultCursor = 'grab'
}
const modes = ref<{ label: Mode; event: Function }[]>([
  {
    label: '选择',
    event: handleSelect,
  },
  {
    label: '移动',
    event: handleMove,
  },
  {
    label: '画笔',
    event: handleBrush,
  },
])
</script>

<template>
  <div class="flex items-center flex-col gap-5 mt-3">
    <canvas id="canvas" class="shadow-md"></canvas>
    <n-space align="center">
      <n-space align="center" class="bg-[#ECECF4] rounded-md">
        <!-- 缩小 -->
        <n-button
          :bordered="false"
          class="hover:bg-[#f1f0ff]!"
          @click="handleZoomOut"
          title="缩小"
          :focusable="false"
        >
          <template #icon>
            <div class="i-icon-park-outline:minus"></div>
          </template>
        </n-button>
        <div>{{ canvasZoomRatio }}%</div>
        <!-- 放大 -->
        <n-button
          :bordered="false"
          class="hover:bg-[#f1f0ff]!"
          @click="handleZoomIn"
          title="放大"
          :focusable="false"
        >
          <template #icon>
            <div class="i-icon-park-outline:plus"></div>
          </template>
        </n-button>
      </n-space>
      <n-space class="rounded-md">
        <!-- 操作模式 -->
        <n-button
          :bordered="false"
          v-for="mode in modes"
          :key="mode.label"
          @click="toggleMode(mode.label)"
          :label="mode.label"
          :value="mode.label"
          :focusable="false"
          class="rounded-md"
          :class="{ 'bg-[#E0DFFF]!': currentMode === mode.label }"
          :title="mode.label"
        >
          <template #icon>
            <div v-if="mode.label === '选择'" class="i-lucide:mouse-pointer-2 w-1em h-1em"></div>
            <div v-if="mode.label === '移动'" class="i-lucide:hand"></div>
            <div v-if="mode.label === '画笔'" class="i-lucide:pencil w-1em h-1em"></div>
          </template>
        </n-button>
      </n-space>
      <n-space align="center" class="bg-[#ECECF4] rounded-md">
        <n-button
          :bordered="false"
          class="hover:bg-[#f1f0ff]!"
          @click="handleUndo"
          title="撤销"
          :focusable="false"
        >
          <template #icon>
            <div class="i-carbon:undo"></div>
          </template>
        </n-button>
        <n-button
          :bordered="false"
          class="hover:bg-[#f1f0ff]!"
          @click="handleRedo"
          title="重做"
          :focusable="false"
        >
          <template #icon>
            <div class="i-carbon:redo w-1em h-1em"></div>
          </template>
        </n-button>
      </n-space>
      <n-space align="center" class="bg-[#ECECF4] rounded-md">
        <n-button
          :bordered="false"
          class="hover:bg-[#f1f0ff]!"
          @click="handleRotate('left')"
          title="左转"
          :focusable="false"
        >
          <template #icon>
            <div class="i-lucide:rotate-ccw"></div>
          </template>
        </n-button>
        <n-button
          :bordered="false"
          class="hover:bg-[#f1f0ff]!"
          @click="handleRotate('right')"
          title="右转"
          :focusable="false"
        >
          <template #icon>
            <div class="i-lucide:rotate-cw"></div>
          </template>
        </n-button>
      </n-space>
    </n-space>
  </div>
</template>
