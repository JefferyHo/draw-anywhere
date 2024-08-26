<template>
  <div class="setting-wrap">
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';

const state = reactive({
  resolution: {
    x: 1920,
    y: 1080
  }
})

const setReso = () => {

}
</script>

<style lang="scss" scoped>
.setting-wrap {
  display: flex;
  flex-direction: column;
  margin: 24px 0;

  .reso-wrap {}
}

.row {
  display: flex;
  align-items: center;
}

.multi {
  color: #aaa;
  margin: 0 10px;
}

input {
  width: 100px;
  border: none;
  background: #aaa;
  color: #fff;
}
</style>