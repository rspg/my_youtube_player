<template>
    <v-navigation-drawer permanent expand-on-hover mini-variant-width="64">
        <v-list nav dense>
            <template v-for="item in items">
                <v-list-item link @click="click(item.key)" :key="item.key">
                    <v-list-item-avatar>
                        <v-img :src="item.icon"></v-img>
                    </v-list-item-avatar>
                    <v-list-item-title>{{item.title}}</v-list-item-title>
                </v-list-item>
            </template>
        </v-list>
    </v-navigation-drawer>
</template>


<script>
import {ipcRenderer} from 'electron'

export default {
    name: 'Playlist',

    data ()  {
        return { items : null }
    },

    async mounted ()  {
        this.refresh();
    },

    methods:{
        click(key){
            ipcRenderer.invoke('select-playlist', { key });
        },
        async refresh(){
            this.items = await ipcRenderer.invoke("get-playlists");
            setTimeout(this.refresh, 3*1000);
        }
    }
};

</script>