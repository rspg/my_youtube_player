<template>
    <v-btn icon small :color="color" @click="click($event)">
        <slot></slot>
    </v-btn>
</template>

<script>
export default {
  name: 'ToggleButton',
  props: ['value', 'activeColor' ],
  data: () => ({
      innerValue: undefined
  }),
  computed: {
      color(){
          return this.value ? this.activeColor : undefined;
      }
  },
  methods: {
      click(event) {
        event.stopPropagation();
        this.innerValue = !this.value;
        //this.$emit('change', this.innerValue);
        this.$emit('input', this.innerValue);
        this.$emit('change', this.innerValue);
      }
  },
  watch: {
      value :{
        immediate: true,
        handler(value) {
            this.innerValue = value;
        }
      }
  }
}
</script>