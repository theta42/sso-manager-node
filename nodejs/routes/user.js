'use strict';

const router = require('express').Router();
const {User} = require('../models/user'); 

router.get('/', async function(req, res, next){
	try{
		return res.json({
			results:  await User[req.query.detail ? "listDetail" : "list"]()
		});
	}catch(error){
		next(error);
	}
});

router.post('/', async function(req, res, next){
	try{
		req.body.created_by = req.user.uid

		return res.json({results: await User.add(req.body)});
	}catch(error){
		next(error);
	}
});

router.delete('/:uid', async function(req, res, next){
	try{
		let user = await User.get(req.params.uid);

		console.log('delete user', user);

		return res.json({uid: req.params.uid, results: await user.remove()})
	}catch(error){
		next(error);
	}
});

router.get('/me', async function(req, res, next){
	try{

		return res.json(await User.get({uid: req.user.uid}));
	}catch(error){
		next(error);
	}
});

router.put('/password', async function(req, res, next){
	try{
		return res.json({results: await req.user.setPassword(req.body)})
	}catch(error){
		next(error);
	}
});

router.put('/:uid/password', async function(req, res, next){
	try{
		let user = await User.get(req.params.uid);
		return res.json({
			results: await user.setPassword(req.body),
			message: `User ${user.uid} password changed.`
		});
	}catch(error){
		next(error);
	}
});

router.post('/invite', async function(req, res, next){
	try{
		let token = await req.user.invite();

		return res.json({token: token.token});
	}catch(error){
		next(error);
	}
});

router.post('/key', async function(req, res, next){
	try{
		let added = await User.addSSHkey({
			uid: req.user.uid,
			key: req.body.key
		});

		return res.status(added === true ? 200 : 400).json({
			message: added
		});

	}catch(error){
		next(error);
	}

});

module.exports = router;
