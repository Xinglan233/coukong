# 原始需求索引

本索引绑定ddcba4d恢复检查点；后续代码进行中，不据本索引认定完整P0或新版生产完成。全部附件SHA-256和字节数见 `manifest.sha256.json`。

## 来源与完整性

- 原执行包19文件，来自授权文本传递后已保存的 `handoff-text`；包含START_HERE、PROMPT、Schema、3示例、9非法夹具、预期结果、校验记录和原清单。原清单18个哈希中16项一致；PROMPT/START_HERE为实体转义文本保存版本，未声称与zip原字节一致。
- 新活动要求：Library `libfile_967927f723308191b6723bbdd0fce789`，实际附件名 `tongye-you-dots-complete-update-prompt(1).md`；本机原文50163字节/700行，复制到 `requirements/activity-and-visual/activity-update.md`。
- 视觉专项：用户完整原文（Sentinel_d0908478d7bc8191a80c1c7658e98e73），本机16486字节/543行，复制到 `requirements/activity-and-visual/visual-style-update.md`。
- 后续覆盖决定：`requirements/latest-decisions.md`，整理明确用户决定，重点保留2026-10-01 08:29上海禁用重置卡、功能优先、16:52指定Figma Make和新版发布暂停。原文附件仍需完整阅读。

## 三张真实原版参考图

| 文件 | Library来源 | 已实际看像素 | 用途 |
| --- | --- | --- | --- |
| [微信图片_20260930142714_12434_10.jpg](references/微信图片_20260930142714_12434_10.jpg) | `libfile_c05bc9868cec8191814d02c57677bf4c` | 是 | 共同空闲空状态；只复用视觉，不恢复旧业务 |
| [微信图片_20260930142714_12433_10.jpg](references/微信图片_20260930142714_12433_10.jpg) | `libfile_b0def1ecbd90819181613996547b3f84` | 是 | 我的日程空状态；只复用视觉，不恢复旧业务 |
| [微信图片_20260930142714_12435_10.jpg](references/微信图片_20260930142714_12435_10.jpg) | `libfile_e7b587212eb88191870ad1a6e7ff38eb` | 是 | 我的设置分组行；只复用视觉，不恢复旧业务 |

## 已授权但本轮未纳入文件的真实资料

| 资料 | 来源 | 状态与限制 |
| --- | --- | --- |
| REDLAND全场原图 | Library `libfile_85b9ae8d85e4819183a81931742cc099` | 1057102字节、2048×1323。此前已物化并看像素；本轮非私密路径未找到，因此未复制。不可用虚构图替代、不反色/重绘。 |
| REDLAND998候选场次包 | Library `libfile_cf4e7159a0b481919df00eb0b01197bc`，`redland-2026-candidate.event.json` | 185548字节、41活动、998场、5天；第三方参考不完整，缺A02/C04，12:30–21:30只是包络窗口。本轮未纳入。 |
| 官方87品牌/摊位目录及用户Excel | 用户提供的官方链接/截图和完整Excel核对记录 | 26需预约、61不需提前预约；本轮未复制原资料。位置/路网仍未核实，不按编号猜。 |

`examples/redland-2026-template.json`仅待核空框架，不是998候选包或完整官方资料。不得为了补齐附件搜私密目录、绕Library拒绝或抓受限笔记。用户可通过正常授权文件方式另行提供这些实际资料。

## 当前界面参考

用户2026-10-01 16:52指定Figma Make `HVEkdtjmMHYBIUQ5LT5ynW`。官方导出及逐文件哈希在 `references/figma-make/`，真实读取范围和业务接线限制见 [Figma参考](FIGMA_REFERENCE.md)。旧三图保留历史来源；最新指定界面优先，业务和安全合同不回退。

## 最新补充

当前版本/实证与剩余见 [当前检查点](CURRENT_STATE.md)。最新用户Figma局部反馈图见 [截图](references/figma-layout-feedback.png)，Library `libfile_6d5c93b432a481918b04ba9442155888`，1372×1944，含Mac浏览器窗口；已实际查看，不按图片尺寸假设CSS视口。新官方Ditto具体来源尚未传入此包，不能编造。

## 最新首用反馈

三张实际物化并逐张查看的新反馈图分别为：

- [多余计划说明](references/figma-feedback-redundant-note.png)。
- [邀请说明间距](references/figma-feedback-invite-spacing.png)。
- [深色计划页](references/figma-feedback-dark-plan.png)。

准确Library来源及最新首用/严格Figma/局部沟通边界见[最新决定](requirements/latest-decisions.md)。

## 文件清单

| 相对路径 | 字节数 | SHA-256 |
| --- | --- | --- |
| `CURRENT_STATE.md` | 7658 | `aaae88c2832abb4328a66d9b5ce7d11c4ab2da5703549f99d8f8bbb4b33e88ca` |
| `FIGMA_REFERENCE.md` | 4742 | `7d048caf09ff7fef8265b57313f0abc8b923a1a0b00b488bacb9edf2b2aa873c` |
| `LOCAL_CHANGES_DECISION.md` | 1103 | `77f4128ba1be3884d06e3ea738eb3a9024b185d190d6aa80588d6399068fcc25` |
| `README.md` | 1166 | `260b492ebf07b41647ac46f08721ff68f15103b835368dcce0fc96aa5d7d247b` |
| `references/figma-feedback-dark-plan.png` | 1017455 | `a74d61baf1d677a5c16db36589e3f01be95e9482ae7b55e47da34fad61ba69ee` |
| `references/figma-feedback-invite-spacing.png` | 15136 | `9e99d3eb6674e7159a25a862f292f86733a6050288f8bb57545f7c261f5845de` |
| `references/figma-feedback-redundant-note.png` | 10776 | `283d3b7eaa58ce962e10f7b884443b9fbf9cfc0c66e42711139969a155b7adb0` |
| `references/figma-layout-feedback.png` | 851777 | `f0a491a0df5f7e2f44204873a98bf6e86758a1284b837a65204d4e8acf0b5bf2` |
| `references/figma-make/package.json` | 584 | `d0e8d76cc6ff9884bd88bdbbd530e164e0c0bcf47a4948075be8a4786a4f97fd` |
| `references/figma-make/provenance.json` | 1176 | `c3b83f9cd166cd5cf558fcbd4eb5a493cba5b2e0533eda628e1905f1b8061721` |
| `references/figma-make/src/App.tsx` | 63268 | `3f92ca267724cf5bab3c9ba4335db53d8f51f1d7fe13cfa4990fbdd424cbcb07` |
| `references/figma-make/src/data.ts` | 4403 | `1ae488b9a08fc1a5fb6bc5e4c23af43a896058faf5ae1b7ec033471aeca50d6d` |
| `references/figma-make/src/index.css` | 2238 | `40cf007570671d40fe843e1711eca28eb382069dad719182a3755dac8867e614` |
| `references/figma-make/src/main.tsx` | 232 | `6c2ddad066d2a90b04cf766465b454de0a9f031965311a3609c87f0e495c3383` |
| `references/figma-make/src/ui.tsx` | 8231 | `69ec4a89a85f5b481c83a03614ababdeee52fc939f40b64f4418eaf0043899a2` |
| `references/provenance.json` | 958 | `8370adc8dcefd7f92bb390fbe936cfeb6d2b503964a5dac11dfc5243cba44400` |
| `references/微信图片_20260930142714_12433_10.jpg` | 143222 | `d87d3b0e120e5c6748206e7bdd011174573b72dc7e15d2b0e561c198bf4fb3f1` |
| `references/微信图片_20260930142714_12434_10.jpg` | 126676 | `65aeeccc1def7bcb0733e8c971121f52a47d12e01cd06b562c0052c77efda5b9` |
| `references/微信图片_20260930142714_12435_10.jpg` | 153567 | `731b39dad95f7598f16b62cf796085d0e21790aba61e8485ed1a1468fad173d7` |
| `requirements/activity-and-visual/activity-update.md` | 50163 | `df58ac0e7f7987759cd4ea237b012e1584fcae58eb860ad60da4a429dd2b71af` |
| `requirements/activity-and-visual/visual-style-update.md` | 16486 | `a18f83855e6dad190b47c6fe7b6a42e24acc4dd25069ded07c264eecb12e02e8` |
| `requirements/latest-decisions.md` | 15357 | `eb3643fbc064f03b8156bd42616426aae7a6cce305b2da5c2be9c7ce0e3981ad` |
| `requirements/original-execution-package/HANDOFF_CHECKS.md` | 1102 | `37875b2f2879f8642010d10db605feb4c33d880a340367aae02fd773d7840ebb` |
| `requirements/original-execution-package/PROMPT.md` | 60312 | `5f3b8bf2897a7ecf049cf1bb21b0664c7a9b2629cd95d28778e49e6dcc36dfdf` |
| `requirements/original-execution-package/START_HERE.md` | 1746 | `108820a3c6de2cdf5cce98f3811ca66df1e484d19908bc7c9f142727e08873bd` |
| `requirements/original-execution-package/examples/event-demo.json` | 1398 | `1d0745639cbb21f1b4524e98bf51b2ba072100b30ff797cc1f961d0052b38c89` |
| `requirements/original-execution-package/examples/event-minimal.json` | 643 | `4742bc23934d75c9986c4d748a43551dc6bc69c67c0fa7f38d046b7de3ec0f1a` |
| `requirements/original-execution-package/examples/redland-2026-template.json` | 1605 | `729d62993fedc49741f901f7fd63b5d2aa0ba7727f7020fda8ec9084c23bf37c` |
| `requirements/original-execution-package/fixtures/expected-results.json` | 752 | `f2e2e763d81b0f3c389dfe1a25b3e671a9d02a957214afa0d7ea7c6393df38ce` |
| `requirements/original-execution-package/fixtures/invalid/blank-title.json` | 1380 | `3f3710d16c051538c3cd2982106d01e136ba1a9fc7058555c917660dd06f99b0` |
| `requirements/original-execution-package/fixtures/invalid/duplicate-object-key.json` | 665 | `aea29ea4186ead0ec87177adc351784e3d9c66d647b6282b3b7b31301a6ad42e` |
| `requirements/original-execution-package/fixtures/invalid/duplicate-session-id.json` | 1398 | `95858b478627088a9a670c9bd50da4cce969c7e70137da6670190c60039b95a3` |
| `requirements/original-execution-package/fixtures/invalid/invalid-minute.json` | 1398 | `aeb6903292193e37c7a4d4e39f172e1d70c8b352dd477902b8259289630e8fe5` |
| `requirements/original-execution-package/fixtures/invalid/missing-day.json` | 1440 | `52947df6b8e1ee80ca818104792da60782e7bb378d1ba5399c58ded3852af8bf` |
| `requirements/original-execution-package/fixtures/invalid/overlapping-open.json` | 1398 | `0c4c05ef4d435a2ab359730358b52c490dd01539854ad1118cd7aa7b4009dff7` |
| `requirements/original-execution-package/fixtures/invalid/reversed-interval.json` | 1398 | `21d2fa2f685b6e637bb1aac9412e339c5dffe30e65e5ee532b07de0d9b521b42` |
| `requirements/original-execution-package/fixtures/invalid/session-outside-open.json` | 1398 | `05af32e4527ead658d9683c2f662406013bdba7b82be4e561f08a948f0b979d1` |
| `requirements/original-execution-package/fixtures/invalid/unknown-version.json` | 1398 | `2add16919ab5f2ecc1c25b8c24037c51a486f3611a2b9c105004d4b7d2acdef5` |
| `requirements/original-execution-package/schemas/event-package.v1.schema.json` | 5674 | `23e469e2b541f2ab6f2763e278ebf8a932fa45cc87d3fd7897f6f90df34f0ce6` |
| `requirements/original-execution-package/validation-report.json` | 2934 | `3d7c68451294d1982fedf33911424d0b9888f973eb52e982080a6fd26c15f187` |
| `source-manifest-check.json` | 4773 | `d7958c14ce3159695ecf8f9e8e4a39eb0188763d44edf85e2637545a113394c7` |
