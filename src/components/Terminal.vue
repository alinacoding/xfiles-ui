<template>
  <div>
    <div class="button" @click="print()">PRINT</div>
    <my-react-terminal/>
  </div>
</template>

<script>

import MyReactTerminal  from './Terminal.js';

export default {
  /* data, methods, etc */
  methods : {
    print() {
      console.log(this)
    }
  },
  components: { "my-react-terminal": MyReactTerminal }
}
</script>
