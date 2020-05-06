'use strict';

const { Client, Attribute, Change } = require('ldapts');
const crypto = require('crypto');

const {Mail} = require('./email');
const {Token, InviteToken} = require('./token');
const conf = require('../app').conf.ldap;

const client = new Client({
  url: conf.url,
});

async function addPosixGroup(client, data){
  try{
    const groups = (await client.search(conf.groupBase, {
      scope: 'sub',
      filter: '(&(objectClass=posixGroup))',
    })).searchEntries;

    data.gidNumber = (Math.max(...groups.map(i => i.gidNumber))+1)+'';

    await client.add(`cn=${data.cn},${conf.groupBase}`, {
      cn: data.cn,
      gidNumber: data.gidNumber,
      objectclass: [ 'posixGroup', 'top' ]
    });

    return data;

  }catch(error){
    throw error;
  }
}

async function addPosixAccount(client, data){
  try{
    const people = (await client.search(conf.userBase, {
      scope: 'sub',
      filter: conf.userFilter,
    })).searchEntries;

    data.uidNumber = (Math.max(...people.map(i => i.uidNumber))+1)+'';

    await client.add(`cn=${data.cn},${conf.userBase}`, {
      cn: data.cn,
      sn: data.sn,
      uid: data.uid,
      uidNumber: data.uidNumber,
      gidNumber: data.gidNumber,
      givenName: data.givenName,
      mail: data.mail,
      mobile: data.mobile,
      loginShell: data.loginShell,
      homeDirectory: data.homeDirectory,
      userPassword: data.userPassword,
      objectclass: [ 'inetOrgPerson', 'posixAccount', 'top' ]
    });

    return data

  }catch(error){
    throw error;
  }

}

async function addLdapUser(client, data){

  try{
    data.uid = `${data.givenName[0]}${data.sn}`;
    data.cn = data.uid;
    data.loginShell = '/bin/bash';
    data.homeDirectory= `/home/${data.uid}`;
    data.userPassword = '{MD5}'+crypto.createHash('md5').update(data.userPassword, "binary").digest('base64');

    data = await addPosixGroup(client, data);
    data = await addPosixAccount(client, data);

    return data;

  }catch(error){
    throw error;
  }
}

async function deleteLdapUser(client, data){
	try{
		await client.del(`cn=${data.cn},${conf.groupBase}`);
		await client.del(data.dn);
	}catch(error){
		throw error;
	}
}

async function changeLdapPassword(client, data){
  try{
    await client.modify(`cn=${data.uid},${conf.userBase}`, [
      new Change({
        operation: 'replace',
        modification: new Attribute({
          type: 'userPassword',
          values: ['{MD5}'+crypto.createHash('md5').update(data.userPassword, "binary").digest('base64')] 
        })}),
    ]); 
  }catch(error){
    throw error;
  }
}

const user_parse = function(data){
	if(data[conf.userNameAttribute]){
		data.username = data[conf.userNameAttribute]
	}

	return data;
}

var User = {}

User.backing = "LDAP";

User.list = async function(){
	try{
		await client.bind(conf.bindDN, conf.bindPassword);

		const res = await client.search(conf.userBase, {
		  scope: 'sub',
		  filter: conf.userFilter,
		  attributes: ['*', 'createTimestamp', 'modifyTimestamp'],
		});

		await client.unbind();

		return res.searchEntries.map(function(user){return user.uid});
	}catch(error){
		throw error;
	}
};

User.listDetail = async function(){
	try{
		await client.bind(conf.bindDN, conf.bindPassword);

		const res = await client.search(conf.userBase, {
		  scope: 'sub',
		  filter: conf.userFilter,
		  attributes: ['*', 'createTimestamp', 'modifyTimestamp'],
		});

		await client.unbind();

		let users = []

		for(let user of res.searchEntries){
			let obj = Object.create(this);
			Object.assign(obj, user_parse(user));
			
			users.push(obj)

		}

		return users;

	}catch(error){
		throw error;
	}
};

User.get = async function(data){
	try{
		if(typeof data !== 'object'){
			let uid = data;
			data = {};
			data.uid = uid;
		}
		
		await client.bind(conf.bindDN, conf.bindPassword);

		let filter = `(&${conf.userFilter}(${conf.userNameAttribute}=${data.uid}))`;

		const res = await client.search(conf.userBase, {
			scope: 'sub',
			filter: filter,
			attributes: ['*', 'createTimestamp', 'modifyTimestamp'],
		});

		await client.unbind();

		let user = res.searchEntries[0]

		if(user){
			let obj = Object.create(this);
			Object.assign(obj, user_parse(user));
			
			return obj;
		}else{
			let error = new Error('UserNotFound');
			error.name = 'UserNotFound';
			error.message = `LDAP:${data.uid} does not exists`;
			error.status = 404;
			throw error;
		}
	}catch(error){
		throw error;
	}
};

User.exists = async function(data){
	// Return true or false if the requested entry exists ignoring error's.
	try{
		await this.get(data);

		return true
	}catch(error){
		return false;
	}
};

User.add = async function(data) {
	try{
		await client.bind(conf.bindDN, conf.bindPassword);

		await addLdapUser(client, data);

		await client.unbind();

		let user = await this.get(data.uid);


		await Mail.sendTemplate(
			user.mail,
			'welcome',
			{
				user: user
			}
		)

		return user;

	}catch(error){
		if(error.message.includes('exists')){
			let error = new Error('UserNameUsed');
			error.name = 'UserNameUsed';
			error.message = `LDAP:${data.uid} already exists`;
			error.status = 409;

			throw error;
		}
		throw error;
	}
};

User.addByInvite = async function(data){
	try{
		let token = await InviteToken.get(data.token);

		if(!token.is_valid && data.mailToken !== token.mail_token){
			let error = new Error('Token Invalid');
			error.name = 'Token Invalid';
			error.message = `Token is not valid or as allready been used. ${data.token}`;
			error.status = 401;
			throw error;
		}

		data.mail = token.mail;

		let user = await this.add(data);

		if(user){
			await token.consume({claimed_by: user.uid});
			return user;
		}

	}catch(error){
		throw error;
	}

};

User.verifyEmail = async function(data){
	try{
		let token = await InviteToken.get(data.token);
		await token.update({mail: data.mail})
		await Mail.sendTemplate(
			data.mail,
			'validate_link',
			{
				link:`${data.url}/login/invite/${token.token}/${token.mail_token}`
			}
		)
	}catch(error){
		throw error;
	}
};

User.remove = async function(data){
	try{

		await client.bind(conf.bindDN, conf.bindPassword);

		await deleteLdapUser(client, this);

		await client.unbind();

		return true

	}catch(error){
		throw error;
	}
};

// User.setPassword = async function(data){
// 	try{
// 		await linuxUser.setPassword(this.username, data.password);

// 		return this;
// 	}catch(error){
// 		throw error;
// 	}
// };

User.invite = async function(){
	try{
		let token = await InviteToken.add({created_by: this.uid});
		
		return token;

	}catch(error){
		throw error;
	}
};

User.login = async function(data){
	try{
		let user = await this.get(data.uid);

		await client.bind(user.dn, data.password);

		await client.unbind();

		return user;

	}catch(error){
		throw error;
	}
};


module.exports = {User};


// (async function(){
// try{
// 	console.log(await User.list());

// 	console.log(await User.listDetail());

// 	console.log(await User.get('wmantly'))

// }catch(error){
// 	console.error(error)
// }
// })()