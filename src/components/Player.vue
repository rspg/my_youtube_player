<template>
  <div style="margin-left: 60px;">
    <div class="video-player">
      <div id="player"></div>
    </div>
    <div v-if="details != undefined" class="video-details">
      <div class="video-title">{{details.title}}</div>
      <div class="video-stats">
        <div class="video-stats-text">{{details.channel}}</div>
        <div class="video-stats-text">{{details.statistics.viewCount}} 回視聴</div>
        <v-spacer></v-spacer>
        <div class="video-good">
          <v-icon color="#AAAAAA">mdi-thumb-up</v-icon>
          <div class="video-stats-text">{{details.statistics.likeCount}}</div>
        </div>
        <div class="video-bad">
          <v-icon color="#AAAAAA">mdi-thumb-down</v-icon>
          <div class="video-stats-text">{{details.statistics.dislikeCount}}</div>
        </div>
      </div>
      <v-divider></v-divider>
      <div class="video-description">
        {{details.description}}
      </div>
    </div>
  </div>
</template>

<script>
import { ipcRenderer } from 'electron'


export default {
  name: 'Player',
  data: () => ({
    details: undefined,
  }),
  computed:{
    description(){
      return this.details.description.split('\n');
    }
  },
  created(){
    self.onYouTubeIframeAPIReady = () => this.onYouTubeIframeAPIReady()
  },
  mounted() {

    this.ytInstall();

    ipcRenderer.on('video-changed', async (event, arg) => {
      console.log('video-changed ');
      console.log(arg.id);
      this.playVideo(arg.id);

      this.details = await ipcRenderer.invoke('get-video-detail', { id: arg.id });
      console.log(this.details);
    });
  },

  methods:{

    ytInstall(){
      let tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      let firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    },

    onYouTubeIframeAPIReady(){
      console.log("onYouTubeIframeAPIReady");
      self.player = new self.YT.Player('player', {
          height: '100%',
          width: '100%',
          events: {
            'onReady': (event) => this.onPlayerReady(event),
            'onStateChange': (event) => this.onPlayerStateChange(event),
            'onError': (event) => this.onError(event)
          },
          playerVars: {
            'rel': 0,
            'autoplay': 0,
          }
        });

      let element = document.getElementById('player').parentNode;
      let adjust = () => element.style.height = (element.clientWidth*9/16) + 'px';
      window.addEventListener('resize', adjust);
    },
    
    onPlayerReady(event) {
        //event.target.playVideo();
        console.log("PlayerState : " + event.target.getPlayerState());
        if(event.target.getPlayerState() == -1)
            this.playNext();
    },

    onPlayerStateChange(event) {
      console.log("PlayerStateChange : " + event.data);
      this.$emit('onstatechanged', event);
      if (event.data == self.YT.PlayerState.ENDED) {
        this.playNext();
      }
    },

    onError(event) {
      console.log("Error : " + event.data);
      this.playNext();
    },

    async playNext() {
      ipcRenderer.send('play-end');
    },

    playVideo(videoId) {
      self.player.loadVideoById(videoId);
      self.player.playVideo();
    }
  }
};
</script>