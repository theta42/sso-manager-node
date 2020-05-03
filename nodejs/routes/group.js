'use strict';

const router = require('express').Router();
const {Group} = require('../models/group_ldap'); 

router.get('/', async function(req, res, next){
	try{
		return res.json({
			results:  await Group[req.query.detail ? "listDetail" : "list"]()
		});
	}catch(error){
		next(error);
	}
});

router.get('/:name', async function(req, res, next){
	try{
		return res.json({
			results:  await Group.get(req.params.name)
		});
	}catch(error){
		next(error);
	}
});

module.exports = router;
