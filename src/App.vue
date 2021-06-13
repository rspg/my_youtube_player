<template>
  <v-app>
    <v-system-bar window height="48px">
      <img :src="require('./assets/yt_logo_rgb_dark.svg')" height='24px' @click="signin">
      <div style="width:100%; height:80%; -webkit-app-region: drag;">
      </div>
      <div style="display:flex; justify-content: flex-end;">
        <v-btn icon @click="minimize"><v-icon>mdi-minus</v-icon></v-btn>
        <v-btn icon @click="maximize"><v-icon>mdi-checkbox-blank-outline</v-icon></v-btn>
        <v-btn icon @click="close"><v-icon>mdi-close</v-icon></v-btn>
      </div>
    </v-system-bar>
    <v-main>
      <div style="display: flex; width:100%; height:100%;">
        <div style="width: 75%;">
          <Player @onstatechanged="onStateChanged"/>
        </div>
        <div style="width: 25%; min-width: 400px;">
          <PlaylistHeader/>
          <div style="position: relative;">
            <Thumbnails/>
            <ChatReplay ref="chat"/>  
          </div>
        </div>
        <div style="position:absolute; left:0; top:0; height:100%;">
          <Playlist/>
        </div>
      </div>
    </v-main>
  </v-app>
</template>

<script>
import Playlist from './components/Playlist';
import Player from './components/Player';
import PlaylistHeader from './components/PlaylistHeader';
import Thumbnails from './components/Thumbnails';
import ChatReplay from './components/ChatReplay';
import { ipcRenderer } from 'electron'

export default {
  name: 'App',

  components: {
    Playlist,
    Player,
    PlaylistHeader,
    Thumbnails,
    ChatReplay,
  },

  data: () => ({
    //
  }),

  methods : {
    minimize(){
      ipcRenderer.send('minimize');
    },
    maximize(){
      ipcRenderer.send('maximize');
    },
    close(){
      ipcRenderer.send('close');
    },
    signin(){
      ipcRenderer.send('signin');
    },

    onStateChanged(event){
      this.$refs.chat.videoStateChanged(event)
    },
  }
};
</script>
