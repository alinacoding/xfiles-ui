<template>
	<div id="app">
		<ChatContainer/>
		<button @click="printUsersData">Print Data</button>
	</div>
</template>

<script>

import ChatContainer from './components/ChatContainer.vue'
import { usersRef } from '@/firestore'


export default {
	name: 'App',
	components: {
		ChatContainer
	}, 
	methods : {
		printUsersData() {
			usersRef.get().then(querySnapshot => querySnapshot.forEach(doc => {
					console.log(doc.data())
			})).catch(err => {
				console.log('Error getting documents', err);
			});
		}
	}
}
</script>

<style>
#app {
	font-family: Avenir, Helvetica, Arial, sans-serif;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
	text-align: center;
	color: #2c3e50;
	margin-top: 60px;
}
</style>
