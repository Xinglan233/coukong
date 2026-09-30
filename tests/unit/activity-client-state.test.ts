import {describe,it,expect} from 'vitest'
import {receivePersonal,acknowledgePersonal,type PersonalDraft} from '../../src/online/activity/personal-state'
import type {PersonalDTO,PersonalPlan} from '../../shared/activity-contract'
const plan:PersonalPlan={response:{name:'我',presence:[],busy:[],bufferMinutes:0},favorites:[{poiId:'a-09',visited:false}],routes:[]}
const local:PersonalDraft={eventId:'expo-a',personId:'me',plan,revision:2,scheduleRevision:3,spatialRevision:4,generation:7,dirty:true}
const remote:PersonalDTO={id:'me',eventId:'expo-a',plan:{...plan,favorites:[]},revision:3,scheduleRevision:4,spatialRevision:4,updatedAt:'2026-10-01T00:00:00Z'}
describe('独立个人计划的恢复与提交竞态',()=>{it('脏草稿不被刷新或新活动版本覆盖',()=>{expect(receivePersonal(local,remote)).toEqual(local)});it('跨活动回复不能串收藏',()=>{expect(()=>receivePersonal(local,{...remote,eventId:'expo-b'})).toThrow()});it('慢提交期间新收藏仍未提交，个人revision采用已成功版本',()=>{const next=acknowledgePersonal(local,{...remote,scheduleRevision:3},6);expect(next.dirty).toBe(true);expect(next.plan.favorites).toEqual(plan.favorites);expect(next.revision).toBe(3);expect(next.scheduleRevision).toBe(3)});it('同编辑世代成功后可以清除待同步标记',()=>{const next=acknowledgePersonal(local,{...remote,plan,scheduleRevision:3},7);expect(next.dirty).toBe(false);expect(next.plan).toEqual(plan)})})
