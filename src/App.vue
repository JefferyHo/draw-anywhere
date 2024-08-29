<script setup lang="ts">
import CanvasEditor from './components/CanvasEditor.vue';
import SettingPanel from './components/Setting.vue';
</script>

<template>
  <div class="page-wrap">
    <div class="sider-wrap">
      <setting-panel />
    </div>
    <div class="content-wrap">
      <canvas-editor />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page-wrap {
  width: 100vw;
  height: 100vh;
  display: flex;
}

.sider-wrap {
  width: 0px;
  background: darkslategray;
  height: 100%;
}

.content-wrap {
  flex: 1;
  height: 100%;
}
</style>
