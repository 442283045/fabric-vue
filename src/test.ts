// Initialize the canvas
const canvas = new fabric.Canvas('canvas', {
  width: 800,
  height: 600,
})

let image, clipPath

// Load the image
fabric.Image.fromURL('path/to/your/image.jpg', (img) => {
  image = img

  // Scale image to fit canvas
  const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
  img.scale(scale)

  // Center the image
  img.set({
    left: (canvas.width - img.width * scale) / 2,
    top: (canvas.height - img.height * scale) / 2,
  })

  // Create a clipPath matching the image bounds
  clipPath = new fabric.Rect({
    left: img.left,
    top: img.top,
    width: img.width * scale,
    height: img.height * scale,
    absolutePositioned: true,
  })

  canvas.add(img)
  canvas.renderAll()
})

// Custom drawing logic
canvas.on('mouse:down', (options) => {
  if (!image) return

  const pointer = canvas.getPointer(options.e)
  if (clipPath.containsPoint(pointer)) {
    canvas.isDrawing = true
    canvas.freeDrawingBrush.onMouseDown(options.e)
  }
})

canvas.on('mouse:move', (options) => {
  if (!canvas.isDrawing) return

  const pointer = canvas.getPointer(options.e)
  if (clipPath.containsPoint(pointer)) {
    canvas.freeDrawingBrush.onMouseMove(options.e)
  } else {
    canvas.isDrawing = false
    canvas.renderAll()
  }
})

canvas.on('mouse:up', () => {
  canvas.isDrawing = false
  canvas.renderAll()
})

// Zoom functionality
canvas.on('mouse:wheel', (opt) => {
  const delta = opt.e.deltaY
  let zoom = canvas.getZoom()
  zoom *= 0.999 ** delta
  if (zoom > 20) zoom = 20
  if (zoom < 0.01) zoom = 0.01

  const point = new fabric.Point(opt.e.offsetX, opt.e.offsetY)
  canvas.zoomToPoint(point, zoom)

  // Update clipPath
  const matrix = canvas.viewportTransform
  clipPath.set({
    left: image.left * matrix[0] + matrix[4],
    top: image.top * matrix[3] + matrix[5],
    scaleX: image.scaleX * matrix[0],
    scaleY: image.scaleY * matrix[3],
  })

  opt.e.preventDefault()
  opt.e.stopPropagation()
})

// Enable free drawing mode
canvas.isDrawingMode = true
canvas.freeDrawingBrush.width = 5
canvas.freeDrawingBrush.color = '#ff0000'
