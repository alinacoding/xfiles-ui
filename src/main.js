import Vue from 'vue'
import App from './App.vue'
//import LoadScript from 'vue-plugin-load-script';

Vue.config.productionTip = false

//Vue.use(LoadScript);
//Vue.loadScript("https://www.gstatic.com/firebasejs/7.13.0/firebase-app.js")
export const bus = new Vue();


new Vue({
  render: h => h(App),
}).$mount('#app')
