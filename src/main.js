import Vue from 'vue'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import css from './assets/styles.css'

Vue.config.productionTip = false

new Vue({
  vuetify,
  css,
  render: h => h(App)
}).$mount('#app')
