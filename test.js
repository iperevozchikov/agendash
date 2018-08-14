const test = require('ava');
const supertest = require('supertest');
const express = require('express');
const Agenda = require('agenda');

const agenda = new Agenda().database('mongodb://admin:HuXlDylODkr0PeZW@cluster0-shard-00-00-ry9ye.mongodb.net:27017,cluster0-shard-00-01-ry9ye.mongodb.net:27017,cluster0-shard-00-02-ry9ye.mongodb.net:27017/agendash-test-db?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin', 'agendash-test-collection');

const app = express();
app.use('/', require('./app')(agenda));

const request = supertest(app);

test.before.cb(t => {
  agenda.on('ready', () => {
    t.end();
  });
});

test.beforeEach(async () => {
  await agenda._collection.deleteMany({});
});

test.afterEach(async () => {
  await agenda._collection.deleteMany({});
});

test.serial('GET /api with no jobs should return the correct overview', async t => {
  const res = await request.get('/api');

  t.is(res.body.overview[0].displayName, 'All Jobs');
  t.is(res.body.jobs.length, 0);
});

test.serial('POST /api/jobs/create should confirm the job exists', async t => {
  const res = await request.post('/api/jobs/create')
  .send({
    jobName: 'Test Job',
    jobSchedule: 'in 2 minutes',
    jobRepeatEvery: '',
    jobData: {}
  })
  .set('Accept', 'application/json');

  t.true('created' in res.body);

  agenda._collection.countDocuments({}, {}, (err, res) => {
    t.ifError(err);
    if (res !== 1) {
      throw new Error('Expected one document in database');
    }
  });
});

test.serial('POST /api/jobs/delete should delete the job', async t => {
  const job = await new Promise(resolve => {
    agenda.create('Test Job', {})
    .schedule('in 4 minutes')
    .save()
    .then(
      job => resolve(job),
      err => t.ifError(err)
    );
  });

  const res = await request.post('/api/jobs/delete')
  .send({
    jobIds: [job.attrs._id]
  })
  .set('Accept', 'application/json');

  t.true('deleted' in res.body);

  agenda._collection.countDocuments({}, {}, (err, res) => {
    t.ifError(err);
    t.is(res, 0);
  });
});

test.serial('POST /api/jobs/requeue should requeue the job', async t => {
  const job = await new Promise(resolve => {
    agenda.create('Test Job', {})
    .schedule('in 4 minutes')
    .save()
    .then(
      job => resolve(job),
      err => t.ifError(err)
    );
  });

  const res = await request.post('/api/jobs/requeue')
  .send({
    jobIds: [job.attrs._id]
  })
  .set('Accept', 'application/json');

  t.false('newJobs' in res.body);

  agenda._collection.countDocuments({}, {}, (err, res) => {
    t.ifError(err);
    t.is(res, 2);
  });
});
