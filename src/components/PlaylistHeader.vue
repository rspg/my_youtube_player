<template>
    <div class="playlist-header">
      <v-avatar size="40px"><v-img :src="icon"></v-img></v-avatar>
      <div style="margin: 8px 16px;">{{title}}</div>
    </div>
</template>

<script>
import { ipcRenderer } from 'electron'

export default {
  name: 'PlaylistHeader',
  data: () =>({
      playlistTitle:undefined,
      playlistIcon:undefined,
  }),
  created(){
    ipcRenderer.on('playlist-changed', (event, arg) => {
      this.playlistTitle = arg.title;
      this.playlistIcon = arg.icon;
    });
  },
  computed: {
    title() {
      return !this.playlistTitle ? "" : this.playlistTitle;
    },
    icon() {
      return !this.playlistIcon ? "" : this.playlistIcon;
    }
  },
}
</script>