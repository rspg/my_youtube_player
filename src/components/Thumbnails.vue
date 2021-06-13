<template>
  <div class="thumbnail">
    <div class="thumbnail-toolbar">
        <v-btn-toggle borderless v-model="sort" @change="sortChanged">
          <v-btn icon :disabled="!!querying" value="title-acc"><v-icon>mdi-sort-alphabetical-ascending</v-icon></v-btn>
          <v-btn icon :disabled="!!querying" value="title-dec"><v-icon>mdi-sort-alphabetical-descending</v-icon></v-btn>
          <v-btn icon :disabled="!!querying" value="date-acc"><v-icon>mdi-sort-clock-ascending</v-icon></v-btn>
          <v-btn icon :disabled="!!querying" value="date-dec"><v-icon>mdi-sort-clock-descending</v-icon></v-btn>
          <v-btn icon :disabled="!!querying" value="shuffle"><v-icon>mdi-shuffle</v-icon></v-btn>
        </v-btn-toggle>
        <v-spacer></v-spacer>
        <v-btn @click="scrollToSelection()">
          <strong>{{index!=undefined ? index+1 : '-'}}/{{items.length}}</strong>
        </v-btn>
    </div>
    <v-virtual-scroll
        :bench="benched"
        :items="items"
        :height="height"
        :item-height="itemHeight + 'px'"
        tag="scroll">
      <template v-slot:default="{ item }">
        <v-list-item :key="item.id" @click="selectVideo(item.id)" :input-value="active(item.id)">
          <v-list-item-icon>
            <v-img :src="item.thumbnail"></v-img>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title v-html="item.title" :title="item.title"></v-list-item-title>
            <v-list-item-subtitle>
              {{item.channel}} - {{getLocaleDateString(item.date)}}
            </v-list-item-subtitle>
            <ToggleButton v-model="item.skip" activeColor='red' @change="badChanged(item)">
              <v-icon>mdi-thumb-down</v-icon>
            </ToggleButton>
          </v-list-item-content>
        </v-list-item>
      </template>
    </v-virtual-scroll>
  </div>
</template>


<script>

import ToggleButton from './ToggleButton';
import { ipcRenderer } from 'electron'
import { v4 as uuidv4 } from 'uuid';

function strcmp(a, b) {
  if(a < b) return -1; else if(b < a) return 1;
  return 0;
}

export default {
  name: 'Thumbnails',

  components :{
    ToggleButton
  },
  data: () => ({
    benched: 0,
    itemHeight: 100,
    height: '400px',
    items: [],
    videoid: undefined,
    index: undefined,
    sort:null,
    querying: false,
    playlistKey: undefined,
  }),
  created(){
    ipcRenderer.on('playlist-changed', (event, arg) => {
      console.log('playlist-changed ', arg);
      this.items = [];
      this.querying = uuidv4();
      this.videoid = undefined;
      this.sort = null;
      this.playlistKey = arg.key;
      ipcRenderer.send('query-playlist-items', { token:this.querying });
    });

    ipcRenderer.on('notify-playlist-item', (event, arg) => {
      console.log('notify-playlist-item ' + arg.token);
      if(arg.token != this.querying)
        return;
      if(arg.completed){
        this.querying = undefined;
        this.load();
      }
      else {
        for(let i in arg.value)
          this.items.push(arg.value[i]);
        this.tryScroll();
      }
    });

    ipcRenderer.on('video-changed', (event, arg) => {
      console.log('video-changed');
      this.videoid = arg.id;
      this.index = this.items.findIndex(x => x.id == arg.id);
      console.log('index ' + this.index);
      this.tryScroll();
      this.save();
    });

    ipcRenderer.on('notify-play-end', () => {
      console.log('notify-play-end');

      let items = this.items || [];
      let cursor = this.index;

      let loops = 100;
      while(--loops){
        ++cursor;
        
        let index;
        if(cursor >= this.items.length)
          cursor = 0;
        index = cursor;

        if(items[index].skip)
          continue;

        ipcRenderer.invoke('select-video', { id: items[index].id });
        break;
      }

    });
  },
  mounted() {
    let vscroll = this.$el.getElementsByClassName('v-virtual-scroll')[0]    
    window.addEventListener('resize', ()=>{
      this.height = window.innerHeight - vscroll.getBoundingClientRect().top;
    });
  },
  methods:{
      selectVideo(id){
          ipcRenderer.invoke('select-video', { id });
      },
      active(id){
        return id == this.videoid;
      },
      tryScroll(){
        if(this.index == null)
          return;
        let vscroll = this.$el.getElementsByClassName('v-virtual-scroll')[0];
        if(vscroll){
          let y = this.index*this.itemHeight;
          if(vscroll.scrollHeight > y)
            vscroll.scrollTo(0, y);
        }
      },
      sortChanged(){
        if(this.querying || !this.sort)
          return;

        let id;
        if(this.index != undefined && this.items && this.index < this.items.length){
          id = this.items[this.index].id;
        }

        if(this.sort == 'title-acc'){
          this.items.sort((a, b) => strcmp(a.title, b.title));
        }
        else if(this.sort == 'title-dec'){
          this.items.sort((a, b) => strcmp(b.title, a.title));
        }
        else if(this.sort == 'date-acc'){
          this.items.sort((a, b) => a.date - b.date);
        }
        else if(this.sort == 'date-dec') {
          this.items.sort((a, b) => b.date - a.date);
        }
        else if(this.sort == 'shuffle'){
          this.items.sort((a, b) => strcmp(b.id, a.id));
        }

        if(id)
          this.index = this.items.findIndex(x => x.id == id);
        this.tryScroll();
      },
      badChanged(item) {
        ipcRenderer.invoke('set-skip-item', { id:item.id, value:item.skip });
      },
      scrollToSelection(){
        this.tryScroll();
      },
      getLocaleDateString(date) {
        return date.toLocaleDateString(navigator.language);
      },

      save(){
        if(!this.playlistKey)
          return;
        let data = {
          sort : this.sort,
          videoid : this.videoid
        }
        localStorage.setItem(this.playlistKey, JSON.stringify(data));
      },
      load(){
        if(!this.playlistKey)
          return;
        let videoid;
        let dataJson = localStorage.getItem(this.playlistKey);
        if(dataJson){
          let data = JSON.parse(dataJson);
          this.sort = data.sort;

          this.sortChanged();
          videoid = data.videoid;
        }
        else{
          if(this.items.length)
            videoid = this.items[0].id;
        }
        if(!this.videoid && videoid)
          this.selectVideo(videoid);
      }
  }
};
</script>