'use strict';

const sgMail = require('@sendgrid/mail');
const mustache = require('mustache');
const conf = require('../app').conf;

sgMail.setApiKey(conf.SENDGRID_API_KEY);

var Mail = {};

Mail.send = async function(to, subject, message, from){
	await sgMail.send({
		to: to,
		from: from || 'Theta 42 Accounts <accounts@no-reply.theta42.com>',
		subject: subject,
		text: message,
		html: message,
	});
};


Mail.sendTemplate = async function(to, template, context, from){
	template = require(`../views/email_templates/${template}`);
	await Mail.send(
		to,
		mustache.render(template.subject, context),
		mustache.render(template.message, context),
		from || (template.from && mustache.render(template.message, context))
	)
};

module.exports = {Mail};
