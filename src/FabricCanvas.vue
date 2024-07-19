<script setup lang="ts">
import * as fabric from 'fabric'
import imgUrl from '@/assets/wallhaven.jpg'
import { onMounted } from 'vue'
onMounted(init)
type Mode = '选择' | '移动' | '画笔' | '文字'
let canvas: fabric.Canvas
let mode: Mode = '选择'
let isMoving = false
const history: string[] = shallowReactive([])
const redoStack: string[] = shallowReactive([])
let pencilBrush: fabric.PencilBrush
let currentEditImg: fabric.FabricImage
let dirty = ref(false) // 是否有未保存的更改
const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600
const canvasZoomRatio = ref(100)
const shouldUndo = computed(() => {
  if (history.length === 1 && dirty.value === true) {
    return true
  }
  return history.length > 1
})
const shouldRedo = computed(() => redoStack.length > 0)
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
    selectable: false, // Make the object not selectable
    controls: false,
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
    if (mode === '选择' && opt.target) {
      // ?: 选择模式下，点击到对象上，将对象设置为活动对象
      // canvas.setActiveObject(opt.target)
    }

    if (mode === '移动' && opt && opt.e) {
      isMoving = true
      return
    }

    if (mode === '画笔' && dirty.value === true) {
      saveState()
      return
    }

    if (mode === '文字') {
      // 用户已经输入文字，再次点击其他区域，渲染文字，退出文字模式
      if (activeTextBox) {
        if (activeTextBox.text.trim()) {
          completeTextInput()
          return
        } else {
          // 去掉先前的输入框
          activeTextBox.exitEditing()
          canvas.remove(activeTextBox)
        }
      }

      const pointer = canvas.getViewportPoint(opt.e)
      const textbox = new fabric.Textbox('', {
        left: pointer.x,
        top: pointer.y,
        fontSize: textSize.value,
        borderColor: 'yellow',
        width: 150,
        hasControls: true,
        fill: textPaletteOptions[currentTextColor.value].color,
      })
      canvas.add(textbox)
      canvas.setActiveObject(textbox)
      textbox.enterEditing()
      textbox.hiddenTextarea!.focus()
      activeTextBox = textbox
    }
  })

  canvas.on('mouse:up', (opt) => {
    if (opt && opt.e && mode === '移动') {
      isMoving = false
    }
    // 画笔模式下，将画笔绘制的路径添加到group中
    if (mode === '画笔') {
      dirty.value = true
    }
  })

  // 画布缩放
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
    console.log(canvas.toJSON())
  })
  canvas.on('after:render', () => {
    console.log('rendered')
    canvas.getObjects().forEach((obj) => {
      if (obj.type === 'Image') {
        obj.selectable = false
      }
    })
  })
}

function completeTextInput() {
  if (activeTextBox && activeTextBox.text.trim()) {
    activeTextBox.exitEditing()
    // canvas.remove(activeTextBox) // Optionally disable text mode after adding text
    canvas.renderAll()
    activeTextBox = undefined
    toggleMode('选择')
  }
}

/**
 * 保存画布状态
 */
function saveState(resetRedo = true) {
  history.push(canvas.toJSON())
  if (resetRedo) {
    redoStack.length = 0
  }
  dirty.value = false
  console.log('state saved', history)
}

// 撤销
async function handleUndo() {
  if (history.length === 1 && dirty.value === true) {
    saveState(false)
    redoStack.push(history.pop()!)
    await canvas.loadFromJSON(history[0])
    dirty.value = false
  }
  if (history.length > 1) {
    if (dirty.value === true) {
      saveState(false)
      redoStack.push(history.pop()!)
      await canvas.loadFromJSON(history.pop()!)
      dirty.value = true
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
    if (dirty.value === true) {
      saveState(false)
    }
    await canvas.loadFromJSON(redoState)
    dirty.value = true
    canvas.renderAll()
  }
  console.log('redo', redoStack)
  console.log('undo', history)
}
declare global {
  interface Window {
    canvas: fabric.Canvas
  }
}
async function init() {
  canvas = new fabric.Canvas('canvas', {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: 'rgb(245, 245, 245)',
  })

  window.canvas = canvas
  canvas.preserveObjectStacking = true // 在选择时保持对象的堆叠顺序
  group = new fabric.Group([], {
    width: canvas.width,
    height: canvas.height,
  })
  initBrush()
  await initImage()

  canvas.add(currentEditImg)
  saveState()
  // 画布移动逻辑
  initEventListener()

  canvas.on('object:added', (e) => {
    console.log(e)

    canvas.getObjects().forEach((obj) => {
      obj.borderColor = '#409eff' // 设置选中时的边框颜色
      obj.hasControls = false // 禁用缩放，旋转控制器
      obj.borderScaleFactor = 2 // 设置边框的大小
    })
  })
  // canvas.on('object:moving',() => {
  //   saveState()
  // })
  // canvas.on('object:modified', () => {
  //   saveState()
  // })
  // canvas.on('object:removed', () => {
  //   saveState()
  // })
}

let currentMode = ref<Mode>('选择')
let group: fabric.Group
function handleRotate(direction: 'left' | 'right') {
  // 旋转整个画布(将所有对象放入一个group中，然后旋转group)
  group.removeAll()
  group.add(...canvas.getObjects())
  const rotationAmount = direction === 'left' ? -90 : 90
  group.rotate((group.angle || 0) + rotationAmount)
  canvas.clear()
  canvas.add(...group.getObjects())

  canvas.renderAll()

  console.log(canvas.toJSON())
}
function handleZoomIn() {
  const centerX = canvas.getWidth() / 2
  const centerY = canvas.getHeight() / 2
  console.log(centerX, centerY)
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
    case '文字':
      handleText()
      break
  }
  canvas.renderAll()
}

// 选择模式
function handleSelect() {
  canvas.isDrawingMode = false
  canvas.selection = true
  canvas.forEachObject((obj) => (obj.selectable = true))
  currentEditImg.selectable = false
  canvas.defaultCursor = 'default'
}
// 画笔模式
function handleBrush() {
  canvas.isDrawingMode = true

  canvas.freeDrawingBrush = pencilBrush
}
// 移动模式：对整个画布进行移动，这里只改变cursor样式，相关事件在initEventListener中处理
function handleMove() {
  canvas.forEachObject((obj) => {
    obj.hoverCursor = 'grab'
  })
  canvas.defaultCursor = 'grab'
}

// 文字模式
let activeTextBox: fabric.Textbox | undefined
function handleText() {}
function handleDownload() {
  // 为了导出图片，需要将画布缩放，偏移等操作还原
  const originalZoom = canvas.getZoom()
  const originalVpt = canvas.viewportTransform.slice() as fabric.TMat2D
  canvas.setZoom(1.0)
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
  const dataURL = canvas.toDataURL({
    format: 'png', // You can change this to 'jpeg' or other supported formats
    quality: 1.0, // Quality for JPEGs (0 to 1 scale). Not applicable for PNGs
    multiplier: 1,
  })
  canvas.setZoom(originalZoom)
  canvas.setViewportTransform(originalVpt)

  // Create a temporary link to trigger the download
  const link = document.createElement('a')
  link.href = dataURL
  link.download = 'canvas-image.png' // Suggest a filename for the download
  document.body.appendChild(link) // Append to the document
  link.click() // Trigger the download
  document.body.removeChild(link) // Clean up
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
  {
    label: '文字',
    event: handleText,
  },
])

// 画笔颜色，粗细
const brushPaletteOptions = reactive([
  { id: 1, color: '#e03131' },
  { id: 2, color: '#1e1e1e' },
  { id: 3, color: '#2f9e44' },
  { id: 4, color: '#fc8c00' },
  { id: 5, color: '#1971c2' },
])
const currentBrushColor = ref(0)
function handleColorChange(color: number) {
  currentBrushColor.value = color
  pencilBrush.color = brushPaletteOptions[color].color
}
const brushSize = ref(3)
function handleBrushSizeChange(size: number) {
  pencilBrush.width = size
}

// 文字颜色，粗细
const textPaletteOptions = reactive([
  { id: 1, color: '#e03131' },
  { id: 2, color: '#1e1e1e' },
  { id: 3, color: '#2f9e44' },
  { id: 4, color: '#fc8c00' },
  { id: 5, color: '#1971c2' },
])
const currentTextColor = ref(0)
function handleTextColorChange(colorIndex: number) {
  currentTextColor.value = colorIndex
  if (activeTextBox) {
    activeTextBox.fill = textPaletteOptions[colorIndex].color
    activeTextBox.text = activeTextBox.text + '1'
    canvas.renderAll()
  }
}
const textSize = ref(20)
function handleTextSizeChange(size: number) {
  console.log(activeTextBox)
  if (activeTextBox) {
    activeTextBox.fontSize = size
    // activeTextBox.set({ text: activeTextBox.text + ' ' })
    activeTextBox.setSelectionStyles({
      fontSize: size,
    })
    canvas.renderAll()
  }
  const activeObject = canvas.getActiveObject()
  if (activeObject && activeObject.type === 'textbox') {
    activeObject.set({ fontSize: size })
    canvas.renderAll()
  }
}
</script>

<template>
  <div class="flex items-center flex-col gap-5 mt-3">
    <canvas id="canvas" class="shadow-md"></canvas>

    <div class="fixed top-100px left-[20px] bg-white shadow-md w-200px h-500px rounded-md">
      <div class="p-3 flex flex-col gap-3">
        <div>
          <div class="text-sm mb-2 text-#1e1e1e">画笔颜色</div>
          <div class="flex justify-between">
            <div
              v-for="(color, index) in brushPaletteOptions"
              :key="color.id"
              class="w-5 h-5 cursor-pointer rounded-sm"
              :class="{ 'outline outline-1 outline-offset-2': index === currentBrushColor }"
              :style="{ background: `${color.color}` }"
              @click="handleColorChange(index)"
            ></div>
          </div>
        </div>
        <div>
          <div class="text-sm mb-2 text-#1e1e1e">画笔粗细</div>
          <div class="">
            <n-slider
              v-model:value="brushSize"
              @update:value="handleBrushSizeChange"
              :step="1"
              :min="0"
              :max="10"
            />
          </div>
        </div>
        <div>
          <div class="text-sm mb-2 text-#1e1e1e">文字颜色</div>
          <div class="flex justify-between">
            <div
              v-for="(color, index) in brushPaletteOptions"
              :key="color.id"
              class="w-5 h-5 cursor-pointer rounded-sm"
              :class="{ 'outline outline-1 outline-offset-2': index === currentTextColor }"
              :style="{ background: `${color.color}` }"
              @click="handleTextColorChange(index)"
            ></div>
          </div>
        </div>
        <div>
          <div class="text-sm mb-2 text-#1e1e1e">文字大小</div>
          <div class="">
            <n-slider
              v-model:value="textSize"
              @update:value="handleTextSizeChange"
              :step="2"
              :min="10"
              :max="100"
            />
          </div>
        </div>
      </div>
    </div>
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
            <div v-if="mode.label === '选择'" class="i-lucide:mouse-pointer-2"></div>
            <div v-if="mode.label === '移动'" class="i-lucide:hand"></div>
            <div v-if="mode.label === '画笔'" class="i-lucide:pencil"></div>
            <div v-if="mode.label === '文字'" class="i-icon-park-outline:add-text"></div>
          </template>
        </n-button>
      </n-space>
      <n-space align="center" class="bg-[#ECECF4] rounded-md">
        <!-- undo -->
        <n-button
          :bordered="false"
          class="hover:bg-[#f1f0ff]!"
          @click="handleUndo"
          :disabled="!shouldUndo"
          title="撤销"
          :focusable="false"
        >
          <template #icon>
            <div class="i-carbon:undo"></div>
          </template>
        </n-button>
        <!-- redo -->
        <n-button
          :bordered="false"
          class="hover:bg-[#f1f0ff]!"
          @click="handleRedo"
          :disabled="!shouldRedo"
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
      <n-space align="center" class="bg-[#ECECF4] rounded-md">
        <n-button
          :bordered="false"
          class="hover:bg-[#f1f0ff]!"
          @click="handleDownload"
          title="导出"
          :focusable="false"
        >
          <template #icon>
            <div class="i-carbon:document-download"></div>
          </template>
        </n-button>
      </n-space>
    </n-space>
  </div>
</template>
