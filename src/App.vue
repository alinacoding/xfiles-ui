<template>
	<div id="app">
		<ChatContainer/>
		<button @click="printUsersData">Print Data</button>
		<button @click="addUsersData" :disabled="updatingData">Add Data</button>
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
	data () {
		return {
			users: [
				{
					_id: '6R0MijpK6M4AIrwaaCY2',
					username: 'Luke',
					avatar: 'https://66.media.tumblr.com/avatar_c6a8eae4303e_512.pnj'
				},
				{
					_id: 'SGmFnBZB4xxMv9V4CVlW',
					username: 'Leia',
					avatar: 'https://avatarfiles.alphacoders.com/184/thumb-184913.jpg'
				},
				{
					_id: '6jMsIXUrBHBj7o2cRlau',
					username: 'Yoda',
					avatar:
						'https://vignette.wikia.nocookie.net/teamavatarone/images/4/45/Yoda.jpg/revision/latest?cb=20130224160049'
				}
			], 
			updatingData: false
		}
	},
	methods : {
		async addUsersData() {
			this.updatingData = true;
			const user1 = this.users[0];
			await usersRef.doc(user1._id).set(user1)
			const user2 = this.users[1];
			await usersRef.doc(user2._id).set(user2)
			const user3 = this.users[2];
			await usersRef.doc(user3._id).set(user3)
			this.updatingData = false;
		
		},
		printUsersData() {
			usersRef.get()
			.then(querySnapshot => querySnapshot.forEach(doc => {
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
