'use strict';

const { Client, Attribute, Change } = require('ldapts');
const conf = require('../app').conf.ldap;

const client = new Client({
	url: conf.url,
});

async function getGroups(client){
	try{
		let groups = (await client.search(conf.groupBase, {
			scope: 'sub',
			filter: '(&(objectClass=groupOfNames))',
			attributes: ['*', 'createTimestamp', 'modifyTimestamp'],
		})).searchEntries;

		return groups.map(function(group){
			if(!Array.isArray(group.member)) group.member = [group.member];
			return group
		});
	}catch(error){
		throw error;
	}
}

async function addGroup(client, data){
	try{

		await client.add(`cn=${data.name},${conf.groupBase}`, {
			cn: data.name,
			member: data.owner,
			description: data.description,
			owner: data.owner,
			objectclass: [ 'groupOfNames', 'top'  ]
		});

		return data;

	}catch(error){
		throw error;
	}
}

async function addMember(client, group, user){
	try{
		await client.modify(group.dn, [
			new Change({
				operation: 'add',
				modification: new Attribute({
					type: 'member',
					values: [user.dn] 
				})
			}),
		]); 
	}catch(error){
		if(error = "TypeOrValueExistsError")return ;
		throw error;
	}
}

async function removeMember(client, group, user){
  try{
	await client.modify(group.dn, [
		new Change({
			operation: 'delete',
			modification: new Attribute({
				type: 'member',
				values: [user.dn] 
			})}),
		]); 
	}catch(error){
		if(error = "TypeOrValueExistsError")return ;
		throw error;
	}
}


var Group = {};

Group.list = async function(){
	try{
		await client.bind(conf.bindDN, conf.bindPassword);

		let groups = await getGroups(client)

		await client.unbind();

		return groups.map(group => group.cn);
	}catch(error){
		throw error;
	}
}

Group.listDetail = async function(){
	try{
		await client.bind(conf.bindDN, conf.bindPassword);

		let groups = await getGroups(client)

		await client.unbind();

		return groups;
	}catch(error){
		throw error;
	}
}

Group.get = async function(data){
	try{

		if(typeof data !== 'object'){
			let name = data;
			data = {};
			data.name = name;
		}
		
		await client.bind(conf.bindDN, conf.bindPassword);

		let group = (await client.search(conf.groupBase, {
			scope: 'sub',
			filter: `(&(objectClass=groupOfNames)(cn=${data.name}))`,
			attributes: ['*', 'createTimestamp', 'modifyTimestamp'],
		})).searchEntries;

		await client.unbind();

		if(!Array.isArray(group.member)) group.member = [group.member];

		return group;

	}catch(error){
		throw error;
	}
}

Group.add = async function(data){
	try{
		await client.bind(conf.bindDN, conf.bindPassword);

		await addGroup(client, data);

		await client.unbind();

		return this.get(data);

	}catch(error){

	}
}

module.exports = {Group};
