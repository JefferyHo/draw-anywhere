<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Draw from './editor';

const canvas = ref<HTMLCanvasElement | null>(null);
const canvasOuter = ref<HTMLCanvasElement | null>(null);

let drawClient: Draw;

onMounted(() => {
  if (canvas.value) {
    drawClient = new Draw(canvas.value);
  }

  if (canvasOuter.value) {
    // 拖拽事件
    canvasOuter.value.addEventListener('dragover', (e) => {
      e.preventDefault(); // 允许拖拽
    });

    canvasOuter.value.addEventListener('drop', (e) => {
      e.preventDefault();
      console.log(e?.dataTransfer?.files[0]);
      const file = e?.dataTransfer?.files[0];
      if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event: any) => {
            let src = event.target.result;
            drawClient.add({
              src: src,
              pos: [0, 0, 0, 0],
              type: 'IMAGE',
            });
          };
          reader.readAsDataURL(file);
      }
    });
  }
});
</script>

<template>
  <div class='canvas-wrap' ref="canvasOuter">
    <canvas ref="canvas" />
  </div>
</template>

<style scoped>
.canvas-wrap, canvas {
  width: 100%;
  height: 100%;
}
</style>
