module.exports = [
"[project]/node_modules/@ioredis/commands/built/commands.json (json)", ((__turbopack_context__) => {

__turbopack_context__.v(JSON.parse("{\"acl\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"cat\":{\"arity\":-2,\"flags\":[\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"deluser\":{\"arity\":-3,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"dryrun\":{\"arity\":-4,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"genpass\":{\"arity\":-2,\"flags\":[\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"getuser\":{\"arity\":3,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"list\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"load\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"log\":{\"arity\":-2,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"save\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"setuser\":{\"arity\":-3,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"users\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"whoami\":{\"arity\":2,\"flags\":[\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0}}},\"append\":{\"arity\":3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arcount\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"ardel\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"ardelrange\":{\"arity\":-4,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arget\":{\"arity\":3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"argetrange\":{\"arity\":4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"argrep\":{\"arity\":-6,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arinfo\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arinsert\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arlastitems\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arlen\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"armget\":{\"arity\":-3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"armset\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arnext\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arop\":{\"arity\":-5,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arring\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arscan\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arseek\":{\"arity\":3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arset\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"asking\":{\"arity\":1,\"flags\":[\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"auth\":{\"arity\":-2,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\",\"no_auth\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"backup\":{\"arity\":2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"abort\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"cleanup\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"list\":{\"arity\":2,\"flags\":[\"admin\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"seal\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"start\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"status\":{\"arity\":2,\"flags\":[\"admin\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0}}},\"bgrewriteaof\":{\"arity\":1,\"flags\":[\"admin\",\"noscript\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"bgsave\":{\"arity\":-1,\"flags\":[\"admin\",\"noscript\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"bitcount\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"bitfield\":{\"arity\":-2,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"bitfield_ro\":{\"arity\":-2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"bitop\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":2,\"keyStop\":-1,\"step\":1},\"bitpos\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"blmove\":{\"arity\":6,\"flags\":[\"write\",\"denyoom\",\"blocking\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"blmovem\":{\"arity\":-6,\"flags\":[\"write\",\"denyoom\",\"blocking\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"blmpop\":{\"arity\":-5,\"flags\":[\"write\",\"blocking\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"blpop\":{\"arity\":-3,\"flags\":[\"write\",\"blocking\"],\"keyStart\":1,\"keyStop\":-2,\"step\":1},\"brpop\":{\"arity\":-3,\"flags\":[\"write\",\"blocking\"],\"keyStart\":1,\"keyStop\":-2,\"step\":1},\"brpoplpush\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\",\"blocking\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"bzmpop\":{\"arity\":-5,\"flags\":[\"write\",\"blocking\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"bzpopmax\":{\"arity\":-3,\"flags\":[\"write\",\"blocking\",\"fast\"],\"keyStart\":1,\"keyStop\":-2,\"step\":1},\"bzpopmin\":{\"arity\":-3,\"flags\":[\"write\",\"blocking\",\"fast\"],\"keyStart\":1,\"keyStop\":-2,\"step\":1},\"client\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"caching\":{\"arity\":3,\"flags\":[\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"getname\":{\"arity\":2,\"flags\":[\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"getredir\":{\"arity\":2,\"flags\":[\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"id\":{\"arity\":2,\"flags\":[\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"info\":{\"arity\":2,\"flags\":[\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"kill\":{\"arity\":-3,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"list\":{\"arity\":-2,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"no-evict\":{\"arity\":3,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"no-touch\":{\"arity\":3,\"flags\":[\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"pause\":{\"arity\":-3,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"reply\":{\"arity\":3,\"flags\":[\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"setinfo\":{\"arity\":4,\"flags\":[\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"setname\":{\"arity\":3,\"flags\":[\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"tracking\":{\"arity\":-3,\"flags\":[\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"trackinginfo\":{\"arity\":2,\"flags\":[\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"unblock\":{\"arity\":-3,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"unpause\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0}}},\"cluster\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"addslots\":{\"arity\":-3,\"flags\":[\"admin\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"addslotsrange\":{\"arity\":-4,\"flags\":[\"admin\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"bumpepoch\":{\"arity\":2,\"flags\":[\"admin\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"count-failure-reports\":{\"arity\":3,\"flags\":[\"admin\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"countkeysinslot\":{\"arity\":3,\"flags\":[\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"delslots\":{\"arity\":-3,\"flags\":[\"admin\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"delslotsrange\":{\"arity\":-4,\"flags\":[\"admin\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"failover\":{\"arity\":-2,\"flags\":[\"admin\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"flushslots\":{\"arity\":2,\"flags\":[\"admin\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"forget\":{\"arity\":3,\"flags\":[\"admin\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"getkeysinslot\":{\"arity\":4,\"flags\":[\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"info\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"keyslot\":{\"arity\":3,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"links\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"meet\":{\"arity\":-4,\"flags\":[\"admin\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"migration\":{\"arity\":-4,\"flags\":[\"admin\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"myid\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"myshardid\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"nodes\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"replicas\":{\"arity\":3,\"flags\":[\"admin\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"replicate\":{\"arity\":3,\"flags\":[\"admin\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"reset\":{\"arity\":-2,\"flags\":[\"admin\",\"noscript\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"saveconfig\":{\"arity\":2,\"flags\":[\"admin\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"set-config-epoch\":{\"arity\":3,\"flags\":[\"admin\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"setslot\":{\"arity\":-4,\"flags\":[\"admin\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"shards\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"slaves\":{\"arity\":3,\"flags\":[\"admin\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"slot-stats\":{\"arity\":-4,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"step\":0},\"slots\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"syncslots\":{\"arity\":-3,\"flags\":[\"admin\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0}}},\"command\":{\"arity\":-1,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"count\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"docs\":{\"arity\":-2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"getkeys\":{\"arity\":-3,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"getkeysandflags\":{\"arity\":-3,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"info\":{\"arity\":-2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"list\":{\"arity\":-2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0}}},\"config\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"get\":{\"arity\":-3,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"resetstat\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"rewrite\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"set\":{\"arity\":-4,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"all_succeeded\",\"step\":0}}},\"copy\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"dbsize\":{\"arity\":1,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"agg_sum\",\"step\":0},\"debug\":{\"arity\":-2,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"decr\":{\"arity\":2,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"decrby\":{\"arity\":3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"del\":{\"arity\":-2,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":-1,\"requestPolicy\":\"multi_shard\",\"responsePolicy\":\"agg_sum\",\"step\":1},\"delex\":{\"arity\":-2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"digest\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"discard\":{\"arity\":1,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"dump\":{\"arity\":2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"echo\":{\"arity\":2,\"flags\":[\"loading\",\"stale\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"eval\":{\"arity\":-3,\"flags\":[\"noscript\",\"stale\",\"skip_monitor\",\"no_mandatory_keys\",\"movablekeys\",\"script_runner\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"eval_ro\":{\"arity\":-3,\"flags\":[\"readonly\",\"noscript\",\"stale\",\"skip_monitor\",\"no_mandatory_keys\",\"movablekeys\",\"script_runner\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"evalsha\":{\"arity\":-3,\"flags\":[\"noscript\",\"stale\",\"skip_monitor\",\"no_mandatory_keys\",\"movablekeys\",\"script_runner\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"evalsha_ro\":{\"arity\":-3,\"flags\":[\"readonly\",\"noscript\",\"stale\",\"skip_monitor\",\"no_mandatory_keys\",\"movablekeys\",\"script_runner\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"exec\":{\"arity\":1,\"flags\":[\"noscript\",\"loading\",\"stale\",\"skip_slowlog\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"exists\":{\"arity\":-2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":-1,\"requestPolicy\":\"multi_shard\",\"responsePolicy\":\"agg_sum\",\"step\":1},\"expire\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"expireat\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"expiretime\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"failover\":{\"arity\":-1,\"flags\":[\"admin\",\"noscript\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"fcall\":{\"arity\":-3,\"flags\":[\"noscript\",\"stale\",\"skip_monitor\",\"no_mandatory_keys\",\"movablekeys\",\"script_runner\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"fcall_ro\":{\"arity\":-3,\"flags\":[\"readonly\",\"noscript\",\"stale\",\"skip_monitor\",\"no_mandatory_keys\",\"movablekeys\",\"script_runner\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"flushall\":{\"arity\":-1,\"flags\":[\"write\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"flushdb\":{\"arity\":-1,\"flags\":[\"write\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"function\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"delete\":{\"arity\":3,\"flags\":[\"write\",\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"dump\":{\"arity\":2,\"flags\":[\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"flush\":{\"arity\":-2,\"flags\":[\"write\",\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"kill\":{\"arity\":2,\"flags\":[\"noscript\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"one_succeeded\",\"step\":0},\"list\":{\"arity\":-2,\"flags\":[\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"load\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\",\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"restore\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\",\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"stats\":{\"arity\":2,\"flags\":[\"noscript\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"special\",\"step\":0}}},\"geoadd\":{\"arity\":-5,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"geodist\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"geohash\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"geopos\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"georadius\":{\"arity\":-6,\"flags\":[\"write\",\"denyoom\",\"movablekeys\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"georadius_ro\":{\"arity\":-6,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"georadiusbymember\":{\"arity\":-5,\"flags\":[\"write\",\"denyoom\",\"movablekeys\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"georadiusbymember_ro\":{\"arity\":-5,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"geosearch\":{\"arity\":-7,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"geosearchstore\":{\"arity\":-8,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"get\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"getbit\":{\"arity\":3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"getdel\":{\"arity\":2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"getex\":{\"arity\":-2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"getrange\":{\"arity\":4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"getset\":{\"arity\":3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hdel\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hello\":{\"arity\":-1,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\",\"no_auth\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"hexists\":{\"arity\":3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hexpire\":{\"arity\":-6,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hexpireat\":{\"arity\":-6,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hexpiretime\":{\"arity\":-5,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hget\":{\"arity\":3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hgetall\":{\"arity\":2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hgetdel\":{\"arity\":-5,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hgetex\":{\"arity\":-5,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"himport\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"discard\":{\"arity\":3,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"step\":0},\"discardall\":{\"arity\":2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"step\":0},\"prepare\":{\"arity\":-4,\"flags\":[\"denyoom\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"step\":0},\"set\":{\"arity\":-5,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":2,\"keyStop\":2,\"step\":1}}},\"hincrby\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hincrbyfloat\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hkeys\":{\"arity\":2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hlen\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hmget\":{\"arity\":-3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hmset\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hotkeys\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"get\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"special\",\"responsePolicy\":\"special\",\"step\":0},\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"reset\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"special\",\"step\":0},\"start\":{\"arity\":-2,\"flags\":[\"admin\",\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"special\",\"step\":0},\"stop\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"special\",\"step\":0}}},\"hpersist\":{\"arity\":-5,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hpexpire\":{\"arity\":-6,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hpexpireat\":{\"arity\":-6,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hpexpiretime\":{\"arity\":-5,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hpttl\":{\"arity\":-5,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hrandfield\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hscan\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hset\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hsetex\":{\"arity\":-6,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hsetnx\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hstrlen\":{\"arity\":3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"httl\":{\"arity\":-5,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hvals\":{\"arity\":2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"incr\":{\"arity\":2,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"incrby\":{\"arity\":3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"incrbyfloat\":{\"arity\":3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"increx\":{\"arity\":-2,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"info\":{\"arity\":-1,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"special\",\"step\":0},\"keys\":{\"arity\":2,\"flags\":[\"readonly\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"step\":0},\"lastsave\":{\"arity\":1,\"flags\":[\"loading\",\"stale\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"latency\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"doctor\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"special\",\"step\":0},\"graph\":{\"arity\":3,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"special\",\"step\":0},\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"histogram\":{\"arity\":-2,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"special\",\"step\":0},\"history\":{\"arity\":3,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"special\",\"step\":0},\"latest\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"special\",\"step\":0},\"reset\":{\"arity\":-2,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"agg_sum\",\"step\":0}}},\"lcs\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"lindex\":{\"arity\":3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"linsert\":{\"arity\":5,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"llen\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"lmove\":{\"arity\":5,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"lmovem\":{\"arity\":-5,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"lmpop\":{\"arity\":-4,\"flags\":[\"write\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"lolwut\":{\"arity\":-1,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"lpop\":{\"arity\":-2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"lpos\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"lpush\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"lpushx\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"lrange\":{\"arity\":4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"lrem\":{\"arity\":4,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"lset\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"ltrim\":{\"arity\":4,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"memory\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"doctor\":{\"arity\":2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"special\",\"step\":0},\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"malloc-stats\":{\"arity\":2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"special\",\"step\":0},\"purge\":{\"arity\":2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"stats\":{\"arity\":2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"special\",\"step\":0},\"usage\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":2,\"keyStop\":2,\"step\":1}}},\"mget\":{\"arity\":-2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":-1,\"requestPolicy\":\"multi_shard\",\"step\":1},\"migrate\":{\"arity\":-6,\"flags\":[\"write\",\"movablekeys\"],\"keyStart\":3,\"keyStop\":3,\"step\":1},\"module\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"list\":{\"arity\":2,\"flags\":[\"admin\",\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"load\":{\"arity\":-3,\"flags\":[\"admin\",\"noscript\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"loadex\":{\"arity\":-3,\"flags\":[\"admin\",\"noscript\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"unload\":{\"arity\":3,\"flags\":[\"admin\",\"noscript\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0}}},\"monitor\":{\"arity\":1,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"move\":{\"arity\":3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"mset\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":-1,\"requestPolicy\":\"multi_shard\",\"responsePolicy\":\"all_succeeded\",\"step\":2},\"msetex\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"multi_shard\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"msetnx\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":-1,\"step\":2},\"multi\":{\"arity\":1,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"object\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"encoding\":{\"arity\":3,\"flags\":[\"readonly\"],\"keyStart\":2,\"keyStop\":2,\"step\":1},\"freq\":{\"arity\":3,\"flags\":[\"readonly\"],\"keyStart\":2,\"keyStop\":2,\"step\":1},\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"idletime\":{\"arity\":3,\"flags\":[\"readonly\"],\"keyStart\":2,\"keyStop\":2,\"step\":1},\"refcount\":{\"arity\":3,\"flags\":[\"readonly\"],\"keyStart\":2,\"keyStop\":2,\"step\":1}}},\"persist\":{\"arity\":2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"pexpire\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"pexpireat\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"pexpiretime\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"pfadd\":{\"arity\":-2,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"pfcount\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"pfdebug\":{\"arity\":3,\"flags\":[\"write\",\"denyoom\",\"admin\"],\"keyStart\":2,\"keyStop\":2,\"step\":1},\"pfmerge\":{\"arity\":-2,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"pfselftest\":{\"arity\":1,\"flags\":[\"admin\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"ping\":{\"arity\":-1,\"flags\":[\"fast\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"psetex\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"psubscribe\":{\"arity\":-2,\"flags\":[\"denyoom\",\"pubsub\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"psync\":{\"arity\":-3,\"flags\":[\"admin\",\"noscript\",\"no_async_loading\",\"no_multi\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"pttl\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"publish\":{\"arity\":3,\"flags\":[\"pubsub\",\"loading\",\"stale\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"pubsub\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"channels\":{\"arity\":-2,\"flags\":[\"pubsub\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"numpat\":{\"arity\":2,\"flags\":[\"pubsub\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"numsub\":{\"arity\":-2,\"flags\":[\"pubsub\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"shardchannels\":{\"arity\":-2,\"flags\":[\"pubsub\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"shardnumsub\":{\"arity\":-2,\"flags\":[\"pubsub\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0}}},\"punsubscribe\":{\"arity\":-1,\"flags\":[\"pubsub\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"quit\":{\"arity\":-1,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\",\"no_auth\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"randomkey\":{\"arity\":1,\"flags\":[\"readonly\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"special\",\"step\":0},\"readonly\":{\"arity\":1,\"flags\":[\"loading\",\"stale\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"readwrite\":{\"arity\":1,\"flags\":[\"loading\",\"stale\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"rename\":{\"arity\":3,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"renamenx\":{\"arity\":3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"replconf\":{\"arity\":-1,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"replicaof\":{\"arity\":3,\"flags\":[\"admin\",\"noscript\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"reset\":{\"arity\":1,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\",\"no_auth\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"restore\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"restore-asking\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"asking\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"role\":{\"arity\":1,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"rpop\":{\"arity\":-2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"rpoplpush\":{\"arity\":3,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"rpush\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"rpushx\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"sadd\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"save\":{\"arity\":1,\"flags\":[\"admin\",\"noscript\",\"no_async_loading\",\"no_multi\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"scan\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"special\",\"responsePolicy\":\"special\",\"step\":0},\"scard\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"script\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"debug\":{\"arity\":3,\"flags\":[\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"exists\":{\"arity\":-3,\"flags\":[\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"agg_logical_and\",\"step\":0},\"flush\":{\"arity\":-2,\"flags\":[\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"all_succeeded\",\"step\":0},\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"kill\":{\"arity\":2,\"flags\":[\"noscript\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"one_succeeded\",\"step\":0},\"load\":{\"arity\":3,\"flags\":[\"noscript\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"all_succeeded\",\"step\":0}}},\"sdiff\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"sdiffcard\":{\"arity\":-3,\"flags\":[\"readonly\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"sdiffstore\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"select\":{\"arity\":2,\"flags\":[\"loading\",\"stale\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"set\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"setbit\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"setex\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"setnx\":{\"arity\":3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"setrange\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"shutdown\":{\"arity\":-1,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\",\"no_multi\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"sinter\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"sintercard\":{\"arity\":-3,\"flags\":[\"readonly\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"sinterstore\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"sismember\":{\"arity\":3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"slaveof\":{\"arity\":3,\"flags\":[\"admin\",\"noscript\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"slowlog\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"get\":{\"arity\":-2,\"flags\":[\"admin\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"step\":0},\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"len\":{\"arity\":2,\"flags\":[\"admin\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"agg_sum\",\"step\":0},\"reset\":{\"arity\":2,\"flags\":[\"admin\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_nodes\",\"responsePolicy\":\"all_succeeded\",\"step\":0}}},\"smembers\":{\"arity\":2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"smismember\":{\"arity\":-3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"smove\":{\"arity\":4,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"sort\":{\"arity\":-2,\"flags\":[\"write\",\"denyoom\",\"movablekeys\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"sort_ro\":{\"arity\":-2,\"flags\":[\"readonly\",\"movablekeys\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"spop\":{\"arity\":-2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"spublish\":{\"arity\":3,\"flags\":[\"pubsub\",\"loading\",\"stale\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"srandmember\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"srem\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"sscan\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"ssubscribe\":{\"arity\":-2,\"flags\":[\"denyoom\",\"pubsub\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"strlen\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"subscribe\":{\"arity\":-2,\"flags\":[\"denyoom\",\"pubsub\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"substr\":{\"arity\":4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"sunion\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"sunioncard\":{\"arity\":-3,\"flags\":[\"readonly\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"sunionstore\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"sunsubscribe\":{\"arity\":-1,\"flags\":[\"pubsub\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"swapdb\":{\"arity\":3,\"flags\":[\"write\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"sync\":{\"arity\":1,\"flags\":[\"admin\",\"noscript\",\"no_async_loading\",\"no_multi\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"time\":{\"arity\":1,\"flags\":[\"loading\",\"stale\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"touch\":{\"arity\":-2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":-1,\"requestPolicy\":\"multi_shard\",\"responsePolicy\":\"agg_sum\",\"step\":1},\"trimslots\":{\"arity\":-5,\"flags\":[\"write\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"ttl\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"type\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"unlink\":{\"arity\":-2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":-1,\"requestPolicy\":\"multi_shard\",\"responsePolicy\":\"agg_sum\",\"step\":1},\"unsubscribe\":{\"arity\":-1,\"flags\":[\"pubsub\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"unwatch\":{\"arity\":1,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"vadd\":{\"arity\":-5,\"flags\":[\"write\",\"denyoom\",\"module\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vcard\":{\"arity\":2,\"flags\":[\"readonly\",\"module\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vdim\":{\"arity\":2,\"flags\":[\"readonly\",\"module\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vemb\":{\"arity\":-3,\"flags\":[\"readonly\",\"module\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vgetattr\":{\"arity\":3,\"flags\":[\"readonly\",\"module\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vinfo\":{\"arity\":2,\"flags\":[\"readonly\",\"module\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vismember\":{\"arity\":3,\"flags\":[\"readonly\",\"module\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vlinks\":{\"arity\":-3,\"flags\":[\"readonly\",\"module\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vrandmember\":{\"arity\":-2,\"flags\":[\"readonly\",\"module\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vrange\":{\"arity\":-4,\"flags\":[\"readonly\",\"module\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vrem\":{\"arity\":3,\"flags\":[\"write\",\"module\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vsetattr\":{\"arity\":4,\"flags\":[\"write\",\"module\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vsim\":{\"arity\":-4,\"flags\":[\"readonly\",\"module\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"wait\":{\"arity\":3,\"flags\":[\"blocking\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"agg_min\",\"step\":0},\"waitaof\":{\"arity\":4,\"flags\":[\"blocking\"],\"keyStart\":0,\"keyStop\":0,\"requestPolicy\":\"all_shards\",\"responsePolicy\":\"agg_min\",\"step\":0},\"watch\":{\"arity\":-2,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\",\"allow_busy\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"xack\":{\"arity\":-4,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xackdel\":{\"arity\":-6,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xadd\":{\"arity\":-5,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xautoclaim\":{\"arity\":-6,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xcfgset\":{\"arity\":-2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xclaim\":{\"arity\":-6,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xdel\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xdelex\":{\"arity\":-5,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xgroup\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"create\":{\"arity\":-5,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":2,\"keyStop\":2,\"step\":1},\"createconsumer\":{\"arity\":5,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":2,\"keyStop\":2,\"step\":1},\"delconsumer\":{\"arity\":5,\"flags\":[\"write\"],\"keyStart\":2,\"keyStop\":2,\"step\":1},\"destroy\":{\"arity\":4,\"flags\":[\"write\"],\"keyStart\":2,\"keyStop\":2,\"step\":1},\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"setid\":{\"arity\":-5,\"flags\":[\"write\"],\"keyStart\":2,\"keyStop\":2,\"step\":1}}},\"xidmprecord\":{\"arity\":5,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xinfo\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0,\"subcommands\":{\"consumers\":{\"arity\":4,\"flags\":[\"readonly\"],\"keyStart\":2,\"keyStop\":2,\"step\":1},\"groups\":{\"arity\":3,\"flags\":[\"readonly\"],\"keyStart\":2,\"keyStop\":2,\"step\":1},\"help\":{\"arity\":2,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"stream\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":2,\"keyStop\":2,\"step\":1}}},\"xlen\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xnack\":{\"arity\":-7,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xpending\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xrange\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xread\":{\"arity\":-4,\"flags\":[\"readonly\",\"blocking\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"xreadgroup\":{\"arity\":-7,\"flags\":[\"write\",\"blocking\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"xrevrange\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xsetid\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xtrim\":{\"arity\":-4,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zadd\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zcard\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zcount\":{\"arity\":4,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zdiff\":{\"arity\":-3,\"flags\":[\"readonly\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"zdiffstore\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"movablekeys\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zincrby\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zinter\":{\"arity\":-3,\"flags\":[\"readonly\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"zintercard\":{\"arity\":-3,\"flags\":[\"readonly\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"zinterstore\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"movablekeys\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zlexcount\":{\"arity\":4,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zmpop\":{\"arity\":-4,\"flags\":[\"write\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"zmscore\":{\"arity\":-3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zpopmax\":{\"arity\":-2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zpopmin\":{\"arity\":-2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrandmember\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrange\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrangebylex\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrangebyscore\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrangestore\":{\"arity\":-5,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"zrank\":{\"arity\":-3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrem\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zremrangebylex\":{\"arity\":4,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zremrangebyrank\":{\"arity\":4,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zremrangebyscore\":{\"arity\":4,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrevrange\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrevrangebylex\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrevrangebyscore\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrevrank\":{\"arity\":-3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zscan\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zscore\":{\"arity\":3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zunion\":{\"arity\":-3,\"flags\":[\"readonly\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"zunionstore\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"movablekeys\"],\"keyStart\":1,\"keyStop\":1,\"step\":1}}"));}),
"[project]/node_modules/@ioredis/commands/built/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __importDefault = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : {
        "default": mod
    };
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getKeyIndexes = exports.hasFlag = exports.exists = exports.list = void 0;
const commands_json_1 = __importDefault(__turbopack_context__.r("[project]/node_modules/@ioredis/commands/built/commands.json (json)"));
const commandMetadata = commands_json_1.default;
/**
 * Redis command list
 *
 * All commands are lowercased.
 */ exports.list = Object.keys(commandMetadata);
const flags = {};
exports.list.forEach((commandName)=>{
    flags[commandName] = commandMetadata[commandName].flags.reduce(function(flags, flag) {
        flags[flag] = true;
        return flags;
    }, {});
});
/**
 * Check if the command exists
 */ function exists(commandName, options) {
    commandName = (options === null || options === void 0 ? void 0 : options.caseInsensitive) ? String(commandName).toLowerCase() : commandName;
    return Boolean(commandMetadata[commandName]);
}
exports.exists = exists;
/**
 * Check if the command has the flag
 *
 * Some of possible flags: readonly, noscript, loading
 */ function hasFlag(commandName, flag, options) {
    commandName = (options === null || options === void 0 ? void 0 : options.nameCaseInsensitive) ? String(commandName).toLowerCase() : commandName;
    if (!flags[commandName]) {
        throw new Error("Unknown command " + commandName);
    }
    return Boolean(flags[commandName][flag]);
}
exports.hasFlag = hasFlag;
/**
 * Get indexes of keys in the command arguments
 *
 * @example
 * ```javascript
 * getKeyIndexes('set', ['key', 'value']) // [0]
 * getKeyIndexes('mget', ['key1', 'key2']) // [0, 1]
 * ```
 */ function getKeyIndexes(commandName, args, options) {
    commandName = (options === null || options === void 0 ? void 0 : options.nameCaseInsensitive) ? String(commandName).toLowerCase() : commandName;
    const command = commandMetadata[commandName];
    if (!command) {
        throw new Error("Unknown command " + commandName);
    }
    if (!Array.isArray(args)) {
        throw new Error("Expect args to be an array");
    }
    let resolvedCommand = command;
    for(let i = 0; i < args.length && resolvedCommand.subcommands; i++){
        const subcommand = resolvedCommand.subcommands[String(args[i]).toLowerCase()];
        if (!subcommand) {
            break;
        }
        resolvedCommand = subcommand;
    }
    const keys = [];
    const parseExternalKey = Boolean(options && options.parseExternalKey);
    const takeDynamicKeys = (args, startIndex)=>{
        const keys = [];
        const keyStop = Number(args[startIndex]);
        for(let i = 0; i < keyStop; i++){
            keys.push(i + startIndex + 1);
        }
        return keys;
    };
    const takeKeyAfterToken = (args, startIndex, token)=>{
        for(let i = startIndex; i < args.length - 1; i += 1){
            if (String(args[i]).toLowerCase() === token.toLowerCase()) {
                return i + 1;
            }
        }
        return null;
    };
    switch(commandName){
        case "zunionstore":
        case "zinterstore":
        case "zdiffstore":
            keys.push(0, ...takeDynamicKeys(args, 1));
            break;
        case "eval":
        case "evalsha":
        case "eval_ro":
        case "evalsha_ro":
        case "fcall":
        case "fcall_ro":
        case "blmpop":
        case "bzmpop":
            keys.push(...takeDynamicKeys(args, 1));
            break;
        case "sdiffcard":
        case "sintercard":
        case "sunioncard":
        case "lmpop":
        case "zunion":
        case "zinter":
        case "zmpop":
        case "zintercard":
        case "zdiff":
            {
                keys.push(...takeDynamicKeys(args, 0));
                break;
            }
        case "msetex":
            {
                const numKeys = Number(args[0]);
                for(let i = 0; i < numKeys; i++){
                    keys.push(1 + i * 2);
                }
                break;
            }
        case "georadius":
            {
                keys.push(0);
                const storeKey = takeKeyAfterToken(args, 5, "STORE");
                if (storeKey) keys.push(storeKey);
                const distKey = takeKeyAfterToken(args, 5, "STOREDIST");
                if (distKey) keys.push(distKey);
                break;
            }
        case "georadiusbymember":
            {
                keys.push(0);
                const storeKey = takeKeyAfterToken(args, 4, "STORE");
                if (storeKey) keys.push(storeKey);
                const distKey = takeKeyAfterToken(args, 4, "STOREDIST");
                if (distKey) keys.push(distKey);
                break;
            }
        case "sort":
        case "sort_ro":
            keys.push(0);
            for(let i = 1; i < args.length - 1; i++){
                let arg = args[i];
                if (typeof arg !== "string") {
                    continue;
                }
                const directive = arg.toUpperCase();
                if (directive === "GET") {
                    i += 1;
                    arg = args[i];
                    if (arg !== "#") {
                        if (parseExternalKey) {
                            keys.push([
                                i,
                                getExternalKeyNameLength(arg)
                            ]);
                        } else {
                            keys.push(i);
                        }
                    }
                } else if (directive === "BY") {
                    i += 1;
                    if (parseExternalKey) {
                        keys.push([
                            i,
                            getExternalKeyNameLength(args[i])
                        ]);
                    } else {
                        keys.push(i);
                    }
                } else if (directive === "STORE") {
                    i += 1;
                    keys.push(i);
                }
            }
            break;
        case "migrate":
            if (args[2] === "") {
                for(let i = 5; i < args.length - 1; i++){
                    const arg = args[i];
                    if (typeof arg === "string" && arg.toUpperCase() === "KEYS") {
                        for(let j = i + 1; j < args.length; j++){
                            keys.push(j);
                        }
                        break;
                    }
                }
            } else {
                keys.push(2);
            }
            break;
        case "xreadgroup":
        case "xread":
            // Keys are 1st half of the args after STREAMS argument.
            for(let i = commandName === "xread" ? 0 : 3; i < args.length - 1; i++){
                if (String(args[i]).toUpperCase() === "STREAMS") {
                    for(let j = i + 1; j <= i + (args.length - 1 - i) / 2; j++){
                        keys.push(j);
                    }
                    break;
                }
            }
            break;
        default:
            // Step has to be at least one in this case, otherwise the command does
            // not contain a key.
            if (resolvedCommand.step > 0) {
                const keyStart = resolvedCommand.keyStart - 1;
                const keyStop = resolvedCommand.keyStop > 0 ? resolvedCommand.keyStop : args.length + resolvedCommand.keyStop + 1;
                for(let i = keyStart; i < keyStop; i += resolvedCommand.step){
                    keys.push(i);
                }
            }
            break;
    }
    return keys;
}
exports.getKeyIndexes = getKeyIndexes;
function getExternalKeyNameLength(key) {
    if (typeof key !== "string") {
        key = String(key);
    }
    const hashPos = key.indexOf("->");
    return hashPos === -1 ? key.length : hashPos;
}
}),
"[project]/node_modules/ioredis-mock/node_modules/@ioredis/commands/built/commands.json (json)", ((__turbopack_context__) => {

__turbopack_context__.v(JSON.parse("{\"vadd\":{\"arity\":-5,\"flags\":[\"write\",\"denyoom\",\"module\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vcard\":{\"arity\":2,\"flags\":[\"readonly\",\"module\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vdim\":{\"arity\":2,\"flags\":[\"readonly\",\"module\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vemb\":{\"arity\":-3,\"flags\":[\"readonly\",\"module\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vgetattr\":{\"arity\":3,\"flags\":[\"readonly\",\"module\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vinfo\":{\"arity\":2,\"flags\":[\"readonly\",\"module\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vismember\":{\"arity\":3,\"flags\":[\"readonly\",\"module\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vlinks\":{\"arity\":-3,\"flags\":[\"readonly\",\"module\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vrandmember\":{\"arity\":-2,\"flags\":[\"readonly\",\"module\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vrange\":{\"arity\":-4,\"flags\":[\"readonly\",\"module\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vrem\":{\"arity\":3,\"flags\":[\"write\",\"module\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vsetattr\":{\"arity\":4,\"flags\":[\"write\",\"module\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"vsim\":{\"arity\":-4,\"flags\":[\"readonly\",\"module\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"acl\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"append\":{\"arity\":3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arcount\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"ardel\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"ardelrange\":{\"arity\":-4,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arget\":{\"arity\":3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"argetrange\":{\"arity\":4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"argrep\":{\"arity\":-6,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arinfo\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arinsert\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arlastitems\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arlen\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"armget\":{\"arity\":-3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"armset\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arnext\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arop\":{\"arity\":-5,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arring\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arscan\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arseek\":{\"arity\":3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"arset\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"asking\":{\"arity\":1,\"flags\":[\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"auth\":{\"arity\":-2,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\",\"no_auth\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"bgrewriteaof\":{\"arity\":1,\"flags\":[\"admin\",\"noscript\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"bgsave\":{\"arity\":-1,\"flags\":[\"admin\",\"noscript\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"bitcount\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"bitfield\":{\"arity\":-2,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"bitfield_ro\":{\"arity\":-2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"bitop\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":2,\"keyStop\":-1,\"step\":1},\"bitpos\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"blmove\":{\"arity\":6,\"flags\":[\"write\",\"denyoom\",\"noscript\",\"blocking\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"blmpop\":{\"arity\":-5,\"flags\":[\"write\",\"blocking\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"blpop\":{\"arity\":-3,\"flags\":[\"write\",\"noscript\",\"blocking\"],\"keyStart\":1,\"keyStop\":-2,\"step\":1},\"brpop\":{\"arity\":-3,\"flags\":[\"write\",\"noscript\",\"blocking\"],\"keyStart\":1,\"keyStop\":-2,\"step\":1},\"brpoplpush\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\",\"noscript\",\"blocking\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"bzmpop\":{\"arity\":-5,\"flags\":[\"write\",\"blocking\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"bzpopmax\":{\"arity\":-3,\"flags\":[\"write\",\"noscript\",\"blocking\",\"fast\"],\"keyStart\":1,\"keyStop\":-2,\"step\":1},\"bzpopmin\":{\"arity\":-3,\"flags\":[\"write\",\"noscript\",\"blocking\",\"fast\"],\"keyStart\":1,\"keyStop\":-2,\"step\":1},\"client\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"cluster\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"command\":{\"arity\":-1,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"config\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"copy\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"dbsize\":{\"arity\":1,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"debug\":{\"arity\":-2,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"decr\":{\"arity\":2,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"decrby\":{\"arity\":3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"del\":{\"arity\":-2,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"discard\":{\"arity\":1,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"dump\":{\"arity\":2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"echo\":{\"arity\":2,\"flags\":[\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"eval\":{\"arity\":-3,\"flags\":[\"noscript\",\"stale\",\"skip_monitor\",\"no_mandatory_keys\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"eval_ro\":{\"arity\":-3,\"flags\":[\"readonly\",\"noscript\",\"stale\",\"skip_monitor\",\"no_mandatory_keys\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"evalsha\":{\"arity\":-3,\"flags\":[\"noscript\",\"stale\",\"skip_monitor\",\"no_mandatory_keys\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"evalsha_ro\":{\"arity\":-3,\"flags\":[\"readonly\",\"noscript\",\"stale\",\"skip_monitor\",\"no_mandatory_keys\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"exec\":{\"arity\":1,\"flags\":[\"noscript\",\"loading\",\"stale\",\"skip_slowlog\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"exists\":{\"arity\":-2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"expire\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"expireat\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"expiretime\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"failover\":{\"arity\":-1,\"flags\":[\"admin\",\"noscript\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"fcall\":{\"arity\":-3,\"flags\":[\"noscript\",\"stale\",\"skip_monitor\",\"no_mandatory_keys\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"fcall_ro\":{\"arity\":-3,\"flags\":[\"readonly\",\"noscript\",\"stale\",\"skip_monitor\",\"no_mandatory_keys\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"flushall\":{\"arity\":-1,\"flags\":[\"write\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"flushdb\":{\"arity\":-1,\"flags\":[\"write\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"function\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"geoadd\":{\"arity\":-5,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"geodist\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"geohash\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"geopos\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"georadius\":{\"arity\":-6,\"flags\":[\"write\",\"denyoom\",\"movablekeys\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"georadius_ro\":{\"arity\":-6,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"georadiusbymember\":{\"arity\":-5,\"flags\":[\"write\",\"denyoom\",\"movablekeys\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"georadiusbymember_ro\":{\"arity\":-5,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"geosearch\":{\"arity\":-7,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"geosearchstore\":{\"arity\":-8,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"get\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"getbit\":{\"arity\":3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"getdel\":{\"arity\":2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"getex\":{\"arity\":-2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"getrange\":{\"arity\":4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"getset\":{\"arity\":3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hdel\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hello\":{\"arity\":-1,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\",\"no_auth\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"hexists\":{\"arity\":3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hexpire\":{\"arity\":-6,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hexpireat\":{\"arity\":-6,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hexpiretime\":{\"arity\":-5,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hget\":{\"arity\":3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hgetall\":{\"arity\":2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hgetdel\":{\"arity\":-5,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hgetex\":{\"arity\":-5,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hincrby\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hincrbyfloat\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hkeys\":{\"arity\":2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hlen\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hmget\":{\"arity\":-3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hmset\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hpersist\":{\"arity\":-5,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hpexpire\":{\"arity\":-6,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hpexpireat\":{\"arity\":-6,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hpexpiretime\":{\"arity\":-5,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hpttl\":{\"arity\":-5,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hrandfield\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hscan\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hset\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hsetex\":{\"arity\":-6,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hsetnx\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hstrlen\":{\"arity\":3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"httl\":{\"arity\":-5,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"hvals\":{\"arity\":2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"incr\":{\"arity\":2,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"incrby\":{\"arity\":3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"incrbyfloat\":{\"arity\":3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"increx\":{\"arity\":-2,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"info\":{\"arity\":-1,\"flags\":[\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"keys\":{\"arity\":2,\"flags\":[\"readonly\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"lastsave\":{\"arity\":1,\"flags\":[\"loading\",\"stale\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"latency\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"lcs\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"lindex\":{\"arity\":3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"linsert\":{\"arity\":5,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"llen\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"lmove\":{\"arity\":5,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"lmpop\":{\"arity\":-4,\"flags\":[\"write\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"lolwut\":{\"arity\":-1,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"lpop\":{\"arity\":-2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"lpos\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"lpush\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"lpushx\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"lrange\":{\"arity\":4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"lrem\":{\"arity\":4,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"lset\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"ltrim\":{\"arity\":4,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"memory\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"mget\":{\"arity\":-2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"migrate\":{\"arity\":-6,\"flags\":[\"write\",\"movablekeys\"],\"keyStart\":3,\"keyStop\":3,\"step\":1},\"module\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"monitor\":{\"arity\":1,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"move\":{\"arity\":3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"mset\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":-1,\"step\":2},\"msetex\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"msetnx\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":-1,\"step\":2},\"multi\":{\"arity\":1,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"object\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"persist\":{\"arity\":2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"pexpire\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"pexpireat\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"pexpiretime\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"pfadd\":{\"arity\":-2,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"pfcount\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"pfdebug\":{\"arity\":3,\"flags\":[\"write\",\"denyoom\",\"admin\"],\"keyStart\":2,\"keyStop\":2,\"step\":1},\"pfmerge\":{\"arity\":-2,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"pfselftest\":{\"arity\":1,\"flags\":[\"admin\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"ping\":{\"arity\":-1,\"flags\":[\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"psetex\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"psubscribe\":{\"arity\":-2,\"flags\":[\"pubsub\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"psync\":{\"arity\":-3,\"flags\":[\"admin\",\"noscript\",\"no_async_loading\",\"no_multi\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"pttl\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"publish\":{\"arity\":3,\"flags\":[\"pubsub\",\"loading\",\"stale\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"pubsub\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"punsubscribe\":{\"arity\":-1,\"flags\":[\"pubsub\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"quit\":{\"arity\":-1,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\",\"no_auth\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"randomkey\":{\"arity\":1,\"flags\":[\"readonly\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"readonly\":{\"arity\":1,\"flags\":[\"loading\",\"stale\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"readwrite\":{\"arity\":1,\"flags\":[\"loading\",\"stale\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"rename\":{\"arity\":3,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"renamenx\":{\"arity\":3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"replconf\":{\"arity\":-1,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"replicaof\":{\"arity\":3,\"flags\":[\"admin\",\"noscript\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"reset\":{\"arity\":1,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\",\"no_auth\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"restore\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"restore-asking\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"asking\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"role\":{\"arity\":1,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"rpop\":{\"arity\":-2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"rpoplpush\":{\"arity\":3,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"rpush\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"rpushx\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"sadd\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"save\":{\"arity\":1,\"flags\":[\"admin\",\"noscript\",\"no_async_loading\",\"no_multi\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"scan\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"scard\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"script\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"sdiff\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"sdiffcard\":{\"arity\":-3,\"flags\":[\"readonly\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"sdiffstore\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"select\":{\"arity\":2,\"flags\":[\"loading\",\"stale\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"set\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"setbit\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"setex\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"setnx\":{\"arity\":3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"setrange\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"shutdown\":{\"arity\":-1,\"flags\":[\"admin\",\"noscript\",\"loading\",\"stale\",\"no_multi\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"sinter\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"sintercard\":{\"arity\":-3,\"flags\":[\"readonly\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"sinterstore\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"sismember\":{\"arity\":3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"slaveof\":{\"arity\":3,\"flags\":[\"admin\",\"noscript\",\"stale\",\"no_async_loading\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"slowlog\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"smembers\":{\"arity\":2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"smismember\":{\"arity\":-3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"smove\":{\"arity\":4,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"sort\":{\"arity\":-2,\"flags\":[\"write\",\"denyoom\",\"movablekeys\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"sort_ro\":{\"arity\":-2,\"flags\":[\"readonly\",\"movablekeys\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"spop\":{\"arity\":-2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"spublish\":{\"arity\":3,\"flags\":[\"pubsub\",\"loading\",\"stale\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"srandmember\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"srem\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"sscan\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"ssubscribe\":{\"arity\":-2,\"flags\":[\"pubsub\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"strlen\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"subscribe\":{\"arity\":-2,\"flags\":[\"pubsub\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"substr\":{\"arity\":4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"sunion\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"sunioncard\":{\"arity\":-3,\"flags\":[\"readonly\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"sunionstore\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"sunsubscribe\":{\"arity\":-1,\"flags\":[\"pubsub\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"swapdb\":{\"arity\":3,\"flags\":[\"write\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"sync\":{\"arity\":1,\"flags\":[\"admin\",\"noscript\",\"no_async_loading\",\"no_multi\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"time\":{\"arity\":1,\"flags\":[\"loading\",\"stale\",\"fast\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"touch\":{\"arity\":-2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"ttl\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"type\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"unlink\":{\"arity\":-2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"unsubscribe\":{\"arity\":-1,\"flags\":[\"pubsub\",\"noscript\",\"loading\",\"stale\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"unwatch\":{\"arity\":1,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\",\"allow_busy\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"wait\":{\"arity\":3,\"flags\":[\"noscript\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"watch\":{\"arity\":-2,\"flags\":[\"noscript\",\"loading\",\"stale\",\"fast\",\"allow_busy\"],\"keyStart\":1,\"keyStop\":-1,\"step\":1},\"xack\":{\"arity\":-4,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xadd\":{\"arity\":-5,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xautoclaim\":{\"arity\":-6,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xclaim\":{\"arity\":-6,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xdel\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xdelex\":{\"arity\":-5,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xgroup\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"xinfo\":{\"arity\":-2,\"flags\":[],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"xlen\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xnack\":{\"arity\":-7,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xpending\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xrange\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xread\":{\"arity\":-4,\"flags\":[\"readonly\",\"blocking\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"xreadgroup\":{\"arity\":-7,\"flags\":[\"write\",\"blocking\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"xrevrange\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xsetid\":{\"arity\":-3,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"xtrim\":{\"arity\":-4,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zadd\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zcard\":{\"arity\":2,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zcount\":{\"arity\":4,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zdiff\":{\"arity\":-3,\"flags\":[\"readonly\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"zdiffstore\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"movablekeys\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zincrby\":{\"arity\":4,\"flags\":[\"write\",\"denyoom\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zinter\":{\"arity\":-3,\"flags\":[\"readonly\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"zintercard\":{\"arity\":-3,\"flags\":[\"readonly\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"zinterstore\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"movablekeys\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zlexcount\":{\"arity\":4,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zmpop\":{\"arity\":-4,\"flags\":[\"write\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"zmscore\":{\"arity\":-3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zpopmax\":{\"arity\":-2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zpopmin\":{\"arity\":-2,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrandmember\":{\"arity\":-2,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrange\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrangebylex\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrangebyscore\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrangestore\":{\"arity\":-5,\"flags\":[\"write\",\"denyoom\"],\"keyStart\":1,\"keyStop\":2,\"step\":1},\"zrank\":{\"arity\":3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrem\":{\"arity\":-3,\"flags\":[\"write\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zremrangebylex\":{\"arity\":4,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zremrangebyrank\":{\"arity\":4,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zremrangebyscore\":{\"arity\":4,\"flags\":[\"write\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrevrange\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrevrangebylex\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrevrangebyscore\":{\"arity\":-4,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zrevrank\":{\"arity\":3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zscan\":{\"arity\":-3,\"flags\":[\"readonly\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zscore\":{\"arity\":3,\"flags\":[\"readonly\",\"fast\"],\"keyStart\":1,\"keyStop\":1,\"step\":1},\"zunion\":{\"arity\":-3,\"flags\":[\"readonly\",\"movablekeys\"],\"keyStart\":0,\"keyStop\":0,\"step\":0},\"zunionstore\":{\"arity\":-4,\"flags\":[\"write\",\"denyoom\",\"movablekeys\"],\"keyStart\":1,\"keyStop\":1,\"step\":1}}"));}),
"[project]/node_modules/ioredis-mock/node_modules/@ioredis/commands/built/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __importDefault = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : {
        "default": mod
    };
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getKeyIndexes = exports.hasFlag = exports.exists = exports.list = void 0;
const commands_json_1 = __importDefault(__turbopack_context__.r("[project]/node_modules/ioredis-mock/node_modules/@ioredis/commands/built/commands.json (json)"));
/**
 * Redis command list
 *
 * All commands are lowercased.
 */ exports.list = Object.keys(commands_json_1.default);
const flags = {};
exports.list.forEach((commandName)=>{
    flags[commandName] = commands_json_1.default[commandName].flags.reduce(function(flags, flag) {
        flags[flag] = true;
        return flags;
    }, {});
});
/**
 * Check if the command exists
 */ function exists(commandName, options) {
    commandName = (options === null || options === void 0 ? void 0 : options.caseInsensitive) ? String(commandName).toLowerCase() : commandName;
    return Boolean(commands_json_1.default[commandName]);
}
exports.exists = exists;
/**
 * Check if the command has the flag
 *
 * Some of possible flags: readonly, noscript, loading
 */ function hasFlag(commandName, flag, options) {
    commandName = (options === null || options === void 0 ? void 0 : options.nameCaseInsensitive) ? String(commandName).toLowerCase() : commandName;
    if (!flags[commandName]) {
        throw new Error("Unknown command " + commandName);
    }
    return Boolean(flags[commandName][flag]);
}
exports.hasFlag = hasFlag;
/**
 * Get indexes of keys in the command arguments
 *
 * @example
 * ```javascript
 * getKeyIndexes('set', ['key', 'value']) // [0]
 * getKeyIndexes('mget', ['key1', 'key2']) // [0, 1]
 * ```
 */ function getKeyIndexes(commandName, args, options) {
    commandName = (options === null || options === void 0 ? void 0 : options.nameCaseInsensitive) ? String(commandName).toLowerCase() : commandName;
    const command = commands_json_1.default[commandName];
    if (!command) {
        throw new Error("Unknown command " + commandName);
    }
    if (!Array.isArray(args)) {
        throw new Error("Expect args to be an array");
    }
    const keys = [];
    const parseExternalKey = Boolean(options && options.parseExternalKey);
    const takeDynamicKeys = (args, startIndex)=>{
        const keys = [];
        const keyStop = Number(args[startIndex]);
        for(let i = 0; i < keyStop; i++){
            keys.push(i + startIndex + 1);
        }
        return keys;
    };
    const takeKeyAfterToken = (args, startIndex, token)=>{
        for(let i = startIndex; i < args.length - 1; i += 1){
            if (String(args[i]).toLowerCase() === token.toLowerCase()) {
                return i + 1;
            }
        }
        return null;
    };
    switch(commandName){
        case "zunionstore":
        case "zinterstore":
        case "zdiffstore":
            keys.push(0, ...takeDynamicKeys(args, 1));
            break;
        case "eval":
        case "evalsha":
        case "eval_ro":
        case "evalsha_ro":
        case "fcall":
        case "fcall_ro":
        case "blmpop":
        case "bzmpop":
            keys.push(...takeDynamicKeys(args, 1));
            break;
        case "sdiffcard":
        case "sintercard":
        case "sunioncard":
        case "lmpop":
        case "zunion":
        case "zinter":
        case "zmpop":
        case "zintercard":
        case "zdiff":
            {
                keys.push(...takeDynamicKeys(args, 0));
                break;
            }
        case "msetex":
            {
                const numKeys = Number(args[0]);
                for(let i = 0; i < numKeys; i++){
                    keys.push(1 + i * 2);
                }
                break;
            }
        case "georadius":
            {
                keys.push(0);
                const storeKey = takeKeyAfterToken(args, 5, "STORE");
                if (storeKey) keys.push(storeKey);
                const distKey = takeKeyAfterToken(args, 5, "STOREDIST");
                if (distKey) keys.push(distKey);
                break;
            }
        case "georadiusbymember":
            {
                keys.push(0);
                const storeKey = takeKeyAfterToken(args, 4, "STORE");
                if (storeKey) keys.push(storeKey);
                const distKey = takeKeyAfterToken(args, 4, "STOREDIST");
                if (distKey) keys.push(distKey);
                break;
            }
        case "sort":
        case "sort_ro":
            keys.push(0);
            for(let i = 1; i < args.length - 1; i++){
                let arg = args[i];
                if (typeof arg !== "string") {
                    continue;
                }
                const directive = arg.toUpperCase();
                if (directive === "GET") {
                    i += 1;
                    arg = args[i];
                    if (arg !== "#") {
                        if (parseExternalKey) {
                            keys.push([
                                i,
                                getExternalKeyNameLength(arg)
                            ]);
                        } else {
                            keys.push(i);
                        }
                    }
                } else if (directive === "BY") {
                    i += 1;
                    if (parseExternalKey) {
                        keys.push([
                            i,
                            getExternalKeyNameLength(args[i])
                        ]);
                    } else {
                        keys.push(i);
                    }
                } else if (directive === "STORE") {
                    i += 1;
                    keys.push(i);
                }
            }
            break;
        case "migrate":
            if (args[2] === "") {
                for(let i = 5; i < args.length - 1; i++){
                    const arg = args[i];
                    if (typeof arg === "string" && arg.toUpperCase() === "KEYS") {
                        for(let j = i + 1; j < args.length; j++){
                            keys.push(j);
                        }
                        break;
                    }
                }
            } else {
                keys.push(2);
            }
            break;
        case "xreadgroup":
        case "xread":
            // Keys are 1st half of the args after STREAMS argument.
            for(let i = commandName === "xread" ? 0 : 3; i < args.length - 1; i++){
                if (String(args[i]).toUpperCase() === "STREAMS") {
                    for(let j = i + 1; j <= i + (args.length - 1 - i) / 2; j++){
                        keys.push(j);
                    }
                    break;
                }
            }
            break;
        default:
            // Step has to be at least one in this case, otherwise the command does
            // not contain a key.
            if (command.step > 0) {
                const keyStart = command.keyStart - 1;
                const keyStop = command.keyStop > 0 ? command.keyStop : args.length + command.keyStop + 1;
                for(let i = keyStart; i < keyStop; i += command.step){
                    keys.push(i);
                }
            }
            break;
    }
    return keys;
}
exports.getKeyIndexes = getKeyIndexes;
function getExternalKeyNameLength(key) {
    if (typeof key !== "string") {
        key = String(key);
    }
    const hashPos = key.indexOf("->");
    return hashPos === -1 ? key.length : hashPos;
}
}),
"[project]/node_modules/standard-as-callback/built/utils.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.tryCatch = exports.errorObj = void 0;
//Try catch is not supported in optimizing
//compiler, so it is isolated
exports.errorObj = {
    e: {}
};
let tryCatchTarget;
function tryCatcher(err, val) {
    try {
        const target = tryCatchTarget;
        tryCatchTarget = null;
        return target.apply(this, arguments);
    } catch (e) {
        exports.errorObj.e = e;
        return exports.errorObj;
    }
}
function tryCatch(fn) {
    tryCatchTarget = fn;
    return tryCatcher;
}
exports.tryCatch = tryCatch;
}),
"[project]/node_modules/standard-as-callback/built/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
const utils_1 = __turbopack_context__.r("[project]/node_modules/standard-as-callback/built/utils.js [app-route] (ecmascript)");
function throwLater(e) {
    setTimeout(function() {
        throw e;
    }, 0);
}
function asCallback(promise, nodeback, options) {
    if (typeof nodeback === "function") {
        promise.then((val)=>{
            let ret;
            if (options !== undefined && Object(options).spread && Array.isArray(val)) {
                ret = utils_1.tryCatch(nodeback).apply(undefined, [
                    null
                ].concat(val));
            } else {
                ret = val === undefined ? utils_1.tryCatch(nodeback)(null) : utils_1.tryCatch(nodeback)(null, val);
            }
            if (ret === utils_1.errorObj) {
                throwLater(ret.e);
            }
        }, (cause)=>{
            if (!cause) {
                const newReason = new Error(cause + "");
                Object.assign(newReason, {
                    cause
                });
                cause = newReason;
            }
            const ret = utils_1.tryCatch(nodeback)(cause);
            if (ret === utils_1.errorObj) {
                throwLater(ret.e);
            }
        });
    }
    return promise;
}
exports.default = asCallback;
}),
"[project]/node_modules/redis-errors/lib/modern.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

const assert = __turbopack_context__.r("[externals]/assert [external] (assert, cjs)");
class RedisError extends Error {
    get name() {
        return this.constructor.name;
    }
}
class ParserError extends RedisError {
    constructor(message, buffer, offset){
        assert(buffer);
        assert.strictEqual(typeof offset, 'number');
        const tmp = Error.stackTraceLimit;
        Error.stackTraceLimit = 2;
        super(message);
        Error.stackTraceLimit = tmp;
        this.offset = offset;
        this.buffer = buffer;
    }
    get name() {
        return this.constructor.name;
    }
}
class ReplyError extends RedisError {
    constructor(message){
        const tmp = Error.stackTraceLimit;
        Error.stackTraceLimit = 2;
        super(message);
        Error.stackTraceLimit = tmp;
    }
    get name() {
        return this.constructor.name;
    }
}
class AbortError extends RedisError {
    get name() {
        return this.constructor.name;
    }
}
class InterruptError extends AbortError {
    get name() {
        return this.constructor.name;
    }
}
module.exports = {
    RedisError,
    ParserError,
    ReplyError,
    AbortError,
    InterruptError
};
}),
"[project]/node_modules/redis-errors/lib/old.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

const assert = __turbopack_context__.r("[externals]/assert [external] (assert, cjs)");
const util = __turbopack_context__.r("[externals]/util [external] (util, cjs)");
// RedisError
function RedisError(message) {
    Object.defineProperty(this, 'message', {
        value: message || '',
        configurable: true,
        writable: true
    });
    Error.captureStackTrace(this, this.constructor);
}
util.inherits(RedisError, Error);
Object.defineProperty(RedisError.prototype, 'name', {
    value: 'RedisError',
    configurable: true,
    writable: true
});
// ParserError
function ParserError(message, buffer, offset) {
    assert(buffer);
    assert.strictEqual(typeof offset, 'number');
    Object.defineProperty(this, 'message', {
        value: message || '',
        configurable: true,
        writable: true
    });
    const tmp = Error.stackTraceLimit;
    Error.stackTraceLimit = 2;
    Error.captureStackTrace(this, this.constructor);
    Error.stackTraceLimit = tmp;
    this.offset = offset;
    this.buffer = buffer;
}
util.inherits(ParserError, RedisError);
Object.defineProperty(ParserError.prototype, 'name', {
    value: 'ParserError',
    configurable: true,
    writable: true
});
// ReplyError
function ReplyError(message) {
    Object.defineProperty(this, 'message', {
        value: message || '',
        configurable: true,
        writable: true
    });
    const tmp = Error.stackTraceLimit;
    Error.stackTraceLimit = 2;
    Error.captureStackTrace(this, this.constructor);
    Error.stackTraceLimit = tmp;
}
util.inherits(ReplyError, RedisError);
Object.defineProperty(ReplyError.prototype, 'name', {
    value: 'ReplyError',
    configurable: true,
    writable: true
});
// AbortError
function AbortError(message) {
    Object.defineProperty(this, 'message', {
        value: message || '',
        configurable: true,
        writable: true
    });
    Error.captureStackTrace(this, this.constructor);
}
util.inherits(AbortError, RedisError);
Object.defineProperty(AbortError.prototype, 'name', {
    value: 'AbortError',
    configurable: true,
    writable: true
});
// InterruptError
function InterruptError(message) {
    Object.defineProperty(this, 'message', {
        value: message || '',
        configurable: true,
        writable: true
    });
    Error.captureStackTrace(this, this.constructor);
}
util.inherits(InterruptError, AbortError);
Object.defineProperty(InterruptError.prototype, 'name', {
    value: 'InterruptError',
    configurable: true,
    writable: true
});
module.exports = {
    RedisError,
    ParserError,
    ReplyError,
    AbortError,
    InterruptError
};
}),
"[project]/node_modules/redis-errors/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

const Errors = process.version.charCodeAt(1) < 55 && process.version.charCodeAt(2) === 46 ? __turbopack_context__.r("[project]/node_modules/redis-errors/lib/old.js [app-route] (ecmascript)") : __turbopack_context__.r("[project]/node_modules/redis-errors/lib/modern.js [app-route] (ecmascript)");
module.exports = Errors;
}),
"[project]/node_modules/cluster-key-slot/lib/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/*
 * Copyright 2001-2010 Georges Menie (www.menie.org)
 * Copyright 2010 Salvatore Sanfilippo (adapted to Redis coding style)
 * Copyright 2015 Zihua Li (http://zihua.li) (ported to JavaScript)
 * Copyright 2016 Mike Diarmid (http://github.com/salakar) (re-write for performance, ~700% perf inc)
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of the University of California, Berkeley nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE REGENTS AND CONTRIBUTORS ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE REGENTS AND CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */ /* CRC16 implementation according to CCITT standards.
 *
 * Note by @antirez: this is actually the XMODEM CRC 16 algorithm, using the
 * following parameters:
 *
 * Name                       : "XMODEM", also known as "ZMODEM", "CRC-16/ACORN"
 * Width                      : 16 bit
 * Poly                       : 1021 (That is actually x^16 + x^12 + x^5 + 1)
 * Initialization             : 0000
 * Reflect Input byte         : False
 * Reflect Output CRC         : False
 * Xor constant to output CRC : 0000
 * Output for "123456789"     : 31C3
 */ var lookup = [
    0x0000,
    0x1021,
    0x2042,
    0x3063,
    0x4084,
    0x50a5,
    0x60c6,
    0x70e7,
    0x8108,
    0x9129,
    0xa14a,
    0xb16b,
    0xc18c,
    0xd1ad,
    0xe1ce,
    0xf1ef,
    0x1231,
    0x0210,
    0x3273,
    0x2252,
    0x52b5,
    0x4294,
    0x72f7,
    0x62d6,
    0x9339,
    0x8318,
    0xb37b,
    0xa35a,
    0xd3bd,
    0xc39c,
    0xf3ff,
    0xe3de,
    0x2462,
    0x3443,
    0x0420,
    0x1401,
    0x64e6,
    0x74c7,
    0x44a4,
    0x5485,
    0xa56a,
    0xb54b,
    0x8528,
    0x9509,
    0xe5ee,
    0xf5cf,
    0xc5ac,
    0xd58d,
    0x3653,
    0x2672,
    0x1611,
    0x0630,
    0x76d7,
    0x66f6,
    0x5695,
    0x46b4,
    0xb75b,
    0xa77a,
    0x9719,
    0x8738,
    0xf7df,
    0xe7fe,
    0xd79d,
    0xc7bc,
    0x48c4,
    0x58e5,
    0x6886,
    0x78a7,
    0x0840,
    0x1861,
    0x2802,
    0x3823,
    0xc9cc,
    0xd9ed,
    0xe98e,
    0xf9af,
    0x8948,
    0x9969,
    0xa90a,
    0xb92b,
    0x5af5,
    0x4ad4,
    0x7ab7,
    0x6a96,
    0x1a71,
    0x0a50,
    0x3a33,
    0x2a12,
    0xdbfd,
    0xcbdc,
    0xfbbf,
    0xeb9e,
    0x9b79,
    0x8b58,
    0xbb3b,
    0xab1a,
    0x6ca6,
    0x7c87,
    0x4ce4,
    0x5cc5,
    0x2c22,
    0x3c03,
    0x0c60,
    0x1c41,
    0xedae,
    0xfd8f,
    0xcdec,
    0xddcd,
    0xad2a,
    0xbd0b,
    0x8d68,
    0x9d49,
    0x7e97,
    0x6eb6,
    0x5ed5,
    0x4ef4,
    0x3e13,
    0x2e32,
    0x1e51,
    0x0e70,
    0xff9f,
    0xefbe,
    0xdfdd,
    0xcffc,
    0xbf1b,
    0xaf3a,
    0x9f59,
    0x8f78,
    0x9188,
    0x81a9,
    0xb1ca,
    0xa1eb,
    0xd10c,
    0xc12d,
    0xf14e,
    0xe16f,
    0x1080,
    0x00a1,
    0x30c2,
    0x20e3,
    0x5004,
    0x4025,
    0x7046,
    0x6067,
    0x83b9,
    0x9398,
    0xa3fb,
    0xb3da,
    0xc33d,
    0xd31c,
    0xe37f,
    0xf35e,
    0x02b1,
    0x1290,
    0x22f3,
    0x32d2,
    0x4235,
    0x5214,
    0x6277,
    0x7256,
    0xb5ea,
    0xa5cb,
    0x95a8,
    0x8589,
    0xf56e,
    0xe54f,
    0xd52c,
    0xc50d,
    0x34e2,
    0x24c3,
    0x14a0,
    0x0481,
    0x7466,
    0x6447,
    0x5424,
    0x4405,
    0xa7db,
    0xb7fa,
    0x8799,
    0x97b8,
    0xe75f,
    0xf77e,
    0xc71d,
    0xd73c,
    0x26d3,
    0x36f2,
    0x0691,
    0x16b0,
    0x6657,
    0x7676,
    0x4615,
    0x5634,
    0xd94c,
    0xc96d,
    0xf90e,
    0xe92f,
    0x99c8,
    0x89e9,
    0xb98a,
    0xa9ab,
    0x5844,
    0x4865,
    0x7806,
    0x6827,
    0x18c0,
    0x08e1,
    0x3882,
    0x28a3,
    0xcb7d,
    0xdb5c,
    0xeb3f,
    0xfb1e,
    0x8bf9,
    0x9bd8,
    0xabbb,
    0xbb9a,
    0x4a75,
    0x5a54,
    0x6a37,
    0x7a16,
    0x0af1,
    0x1ad0,
    0x2ab3,
    0x3a92,
    0xfd2e,
    0xed0f,
    0xdd6c,
    0xcd4d,
    0xbdaa,
    0xad8b,
    0x9de8,
    0x8dc9,
    0x7c26,
    0x6c07,
    0x5c64,
    0x4c45,
    0x3ca2,
    0x2c83,
    0x1ce0,
    0x0cc1,
    0xef1f,
    0xff3e,
    0xcf5d,
    0xdf7c,
    0xaf9b,
    0xbfba,
    0x8fd9,
    0x9ff8,
    0x6e17,
    0x7e36,
    0x4e55,
    0x5e74,
    0x2e93,
    0x3eb2,
    0x0ed1,
    0x1ef0
];
/**
 * Convert a string to a UTF8 array - faster than via buffer
 * @param str
 * @returns {Array}
 */ var toUTF8Array = function toUTF8Array(str) {
    var char;
    var i = 0;
    var p = 0;
    var utf8 = [];
    var len = str.length;
    for(; i < len; i++){
        char = str.charCodeAt(i);
        if (char < 128) {
            utf8[p++] = char;
        } else if (char < 2048) {
            utf8[p++] = char >> 6 | 192;
            utf8[p++] = char & 63 | 128;
        } else if ((char & 0xFC00) === 0xD800 && i + 1 < str.length && (str.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
            char = 0x10000 + ((char & 0x03FF) << 10) + (str.charCodeAt(++i) & 0x03FF);
            utf8[p++] = char >> 18 | 240;
            utf8[p++] = char >> 12 & 63 | 128;
            utf8[p++] = char >> 6 & 63 | 128;
            utf8[p++] = char & 63 | 128;
        } else {
            utf8[p++] = char >> 12 | 224;
            utf8[p++] = char >> 6 & 63 | 128;
            utf8[p++] = char & 63 | 128;
        }
    }
    return utf8;
};
/**
 * Convert a string into a redis slot hash.
 * @param str
 * @returns {number}
 */ var generate = module.exports = function generate(str) {
    var char;
    var i = 0;
    var start = -1;
    var result = 0;
    var resultHash = 0;
    var utf8 = typeof str === 'string' ? toUTF8Array(str) : str;
    var len = utf8.length;
    while(i < len){
        char = utf8[i++];
        if (start === -1) {
            if (char === 0x7B) {
                start = i;
            }
        } else if (char !== 0x7D) {
            resultHash = lookup[(char ^ resultHash >> 8) & 0xFF] ^ resultHash << 8;
        } else if (i - 1 !== start) {
            return resultHash & 0x3FFF;
        }
        result = lookup[(char ^ result >> 8) & 0xFF] ^ result << 8;
    }
    return result & 0x3FFF;
};
/**
 * Convert an array of multiple strings into a redis slot hash.
 * Returns -1 if one of the keys is not for the same slot as the others
 * @param keys
 * @returns {number}
 */ module.exports.generateMulti = function generateMulti(keys) {
    var i = 1;
    var len = keys.length;
    var base = generate(keys[0]);
    while(i < len){
        if (generate(keys[i++]) !== base) return -1;
    }
    return base;
};
}),
"[project]/node_modules/ms/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/**
 * Helpers.
 */ var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var w = d * 7;
var y = d * 365.25;
/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */ module.exports = function(val, options) {
    options = options || {};
    var type = typeof val;
    if (type === 'string' && val.length > 0) {
        return parse(val);
    } else if (type === 'number' && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
    }
    throw new Error('val is not a non-empty string or a valid number. val=' + JSON.stringify(val));
};
/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */ function parse(str) {
    str = String(str);
    if (str.length > 100) {
        return;
    }
    var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
    if (!match) {
        return;
    }
    var n = parseFloat(match[1]);
    var type = (match[2] || 'ms').toLowerCase();
    switch(type){
        case 'years':
        case 'year':
        case 'yrs':
        case 'yr':
        case 'y':
            return n * y;
        case 'weeks':
        case 'week':
        case 'w':
            return n * w;
        case 'days':
        case 'day':
        case 'd':
            return n * d;
        case 'hours':
        case 'hour':
        case 'hrs':
        case 'hr':
        case 'h':
            return n * h;
        case 'minutes':
        case 'minute':
        case 'mins':
        case 'min':
        case 'm':
            return n * m;
        case 'seconds':
        case 'second':
        case 'secs':
        case 'sec':
        case 's':
            return n * s;
        case 'milliseconds':
        case 'millisecond':
        case 'msecs':
        case 'msec':
        case 'ms':
            return n;
        default:
            return undefined;
    }
}
/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */ function fmtShort(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
        return Math.round(ms / d) + 'd';
    }
    if (msAbs >= h) {
        return Math.round(ms / h) + 'h';
    }
    if (msAbs >= m) {
        return Math.round(ms / m) + 'm';
    }
    if (msAbs >= s) {
        return Math.round(ms / s) + 's';
    }
    return ms + 'ms';
}
/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */ function fmtLong(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
        return plural(ms, msAbs, d, 'day');
    }
    if (msAbs >= h) {
        return plural(ms, msAbs, h, 'hour');
    }
    if (msAbs >= m) {
        return plural(ms, msAbs, m, 'minute');
    }
    if (msAbs >= s) {
        return plural(ms, msAbs, s, 'second');
    }
    return ms + ' ms';
}
/**
 * Pluralization helper.
 */ function plural(ms, msAbs, n, name) {
    var isPlural = msAbs >= n * 1.5;
    return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
}
}),
"[project]/node_modules/debug/src/common.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 */ function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = __turbopack_context__.r("[project]/node_modules/ms/index.js [app-route] (ecmascript)");
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key)=>{
        createDebug[key] = env[key];
    });
    /**
	* The currently active debug mode names, and names to skip.
	*/ createDebug.names = [];
    createDebug.skips = [];
    /**
	* Map of special "%n" handling functions, for the debug "format" argument.
	*
	* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
	*/ createDebug.formatters = {};
    /**
	* Selects a color for a debug namespace
	* @param {String} namespace The namespace string for the debug instance to be colored
	* @return {Number|String} An ANSI color code for the given namespace
	* @api private
	*/ function selectColor(namespace) {
        let hash = 0;
        for(let i = 0; i < namespace.length; i++){
            hash = (hash << 5) - hash + namespace.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    /**
	* Create a debugger with the given `namespace`.
	*
	* @param {String} namespace
	* @return {Function}
	* @api public
	*/ function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug(...args) {
            // Disabled?
            if (!debug.enabled) {
                return;
            }
            const self = debug;
            // Set `diff` timestamp
            const curr = Number(new Date());
            const ms = curr - (prevTime || curr);
            self.diff = ms;
            self.prev = prevTime;
            self.curr = curr;
            prevTime = curr;
            args[0] = createDebug.coerce(args[0]);
            if (typeof args[0] !== 'string') {
                // Anything else let's inspect with %O
                args.unshift('%O');
            }
            // Apply any `formatters` transformations
            let index = 0;
            args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format)=>{
                // If we encounter an escaped % then don't increase the array index
                if (match === '%%') {
                    return '%';
                }
                index++;
                const formatter = createDebug.formatters[format];
                if (typeof formatter === 'function') {
                    const val = args[index];
                    match = formatter.call(self, val);
                    // Now we need to remove `args[index]` since it's inlined in the `format`
                    args.splice(index, 1);
                    index--;
                }
                return match;
            });
            // Apply env-specific formatting (colors, etc.)
            createDebug.formatArgs.call(self, args);
            const logFn = self.log || createDebug.log;
            logFn.apply(self, args);
        }
        debug.namespace = namespace;
        debug.useColors = createDebug.useColors();
        debug.color = createDebug.selectColor(namespace);
        debug.extend = extend;
        debug.destroy = createDebug.destroy; // XXX Temporary. Will be removed in the next major release.
        Object.defineProperty(debug, 'enabled', {
            enumerable: true,
            configurable: false,
            get: ()=>{
                if (enableOverride !== null) {
                    return enableOverride;
                }
                if (namespacesCache !== createDebug.namespaces) {
                    namespacesCache = createDebug.namespaces;
                    enabledCache = createDebug.enabled(namespace);
                }
                return enabledCache;
            },
            set: (v)=>{
                enableOverride = v;
            }
        });
        // Env-specific initialization logic for debug instances
        if (typeof createDebug.init === 'function') {
            createDebug.init(debug);
        }
        return debug;
    }
    function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
    }
    /**
	* Enables a debug mode by namespaces. This can include modes
	* separated by a colon and wildcards.
	*
	* @param {String} namespaces
	* @api public
	*/ function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === 'string' ? namespaces : '').trim().replace(/\s+/g, ',').split(',').filter(Boolean);
        for (const ns of split){
            if (ns[0] === '-') {
                createDebug.skips.push(ns.slice(1));
            } else {
                createDebug.names.push(ns);
            }
        }
    }
    /**
	 * Checks if the given string matches a namespace template, honoring
	 * asterisks as wildcards.
	 *
	 * @param {String} search
	 * @param {String} template
	 * @return {Boolean}
	 */ function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while(searchIndex < search.length){
            if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === '*')) {
                // Match character or proceed with wildcard
                if (template[templateIndex] === '*') {
                    starIndex = templateIndex;
                    matchIndex = searchIndex;
                    templateIndex++; // Skip the '*'
                } else {
                    searchIndex++;
                    templateIndex++;
                }
            } else if (starIndex !== -1) {
                // Backtrack to the last '*' and try to match more characters
                templateIndex = starIndex + 1;
                matchIndex++;
                searchIndex = matchIndex;
            } else {
                return false; // No match
            }
        }
        // Handle trailing '*' in template
        while(templateIndex < template.length && template[templateIndex] === '*'){
            templateIndex++;
        }
        return templateIndex === template.length;
    }
    /**
	* Disable debug output.
	*
	* @return {String} namespaces
	* @api public
	*/ function disable() {
        const namespaces = [
            ...createDebug.names,
            ...createDebug.skips.map((namespace)=>'-' + namespace)
        ].join(',');
        createDebug.enable('');
        return namespaces;
    }
    /**
	* Returns true if the given mode name is enabled, false otherwise.
	*
	* @param {String} name
	* @return {Boolean}
	* @api public
	*/ function enabled(name) {
        for (const skip of createDebug.skips){
            if (matchesTemplate(name, skip)) {
                return false;
            }
        }
        for (const ns of createDebug.names){
            if (matchesTemplate(name, ns)) {
                return true;
            }
        }
        return false;
    }
    /**
	* Coerce `val`.
	*
	* @param {Mixed} val
	* @return {Mixed}
	* @api private
	*/ function coerce(val) {
        if (val instanceof Error) {
            return val.stack || val.message;
        }
        return val;
    }
    /**
	* XXX DO NOT USE. This is a temporary stub function.
	* XXX It WILL be removed in the next major release.
	*/ function destroy() {
        console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
    }
    createDebug.enable(createDebug.load());
    return createDebug;
}
module.exports = setup;
}),
"[project]/node_modules/debug/src/node.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/**
 * Module dependencies.
 */ const tty = __turbopack_context__.r("[externals]/tty [external] (tty, cjs)");
const util = __turbopack_context__.r("[externals]/util [external] (util, cjs)");
/**
 * This is the Node.js implementation of `debug()`.
 */ exports.init = init;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.destroy = util.deprecate(()=>{}, 'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
/**
 * Colors.
 */ exports.colors = [
    6,
    2,
    3,
    4,
    5,
    1
];
try {
    // Optional dependency (as in, doesn't need to be installed, NOT like optionalDependencies in package.json)
    // eslint-disable-next-line import/no-extraneous-dependencies
    const supportsColor = __turbopack_context__.r("[project]/node_modules/supports-color/index.js [app-route] (ecmascript)");
    if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports.colors = [
            20,
            21,
            26,
            27,
            32,
            33,
            38,
            39,
            40,
            41,
            42,
            43,
            44,
            45,
            56,
            57,
            62,
            63,
            68,
            69,
            74,
            75,
            76,
            77,
            78,
            79,
            80,
            81,
            92,
            93,
            98,
            99,
            112,
            113,
            128,
            129,
            134,
            135,
            148,
            149,
            160,
            161,
            162,
            163,
            164,
            165,
            166,
            167,
            168,
            169,
            170,
            171,
            172,
            173,
            178,
            179,
            184,
            185,
            196,
            197,
            198,
            199,
            200,
            201,
            202,
            203,
            204,
            205,
            206,
            207,
            208,
            209,
            214,
            215,
            220,
            221
        ];
    }
} catch (error) {
// Swallow - we only care if `supports-color` is available; it doesn't have to be.
}
/**
 * Build up the default `inspectOpts` object from the environment variables.
 *
 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
 */ exports.inspectOpts = Object.keys(process.env).filter((key)=>{
    return /^debug_/i.test(key);
}).reduce((obj, key)=>{
    // Camel-case
    const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k)=>{
        return k.toUpperCase();
    });
    // Coerce string value into JS value
    let val = process.env[key];
    if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
    } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
    } else if (val === 'null') {
        val = null;
    } else {
        val = Number(val);
    }
    obj[prop] = val;
    return obj;
}, {});
/**
 * Is stdout a TTY? Colored output is enabled when `true`.
 */ function useColors() {
    return 'colors' in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
}
/**
 * Adds ANSI color escape codes if enabled.
 *
 * @api public
 */ function formatArgs(args) {
    const { namespace: name, useColors } = this;
    if (useColors) {
        const c = this.color;
        const colorCode = '\u001B[3' + (c < 8 ? c : '8;5;' + c);
        const prefix = `  ${colorCode};1m${name} \u001B[0m`;
        args[0] = prefix + args[0].split('\n').join('\n' + prefix);
        args.push(colorCode + 'm+' + module.exports.humanize(this.diff) + '\u001B[0m');
    } else {
        args[0] = getDate() + name + ' ' + args[0];
    }
}
function getDate() {
    if (exports.inspectOpts.hideDate) {
        return '';
    }
    return new Date().toISOString() + ' ';
}
/**
 * Invokes `util.formatWithOptions()` with the specified arguments and writes to stderr.
 */ function log(...args) {
    return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + '\n');
}
/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */ function save(namespaces) {
    if (namespaces) {
        process.env.DEBUG = namespaces;
    } else {
        // If you set a process.env field to null or undefined, it gets cast to the
        // string 'null' or 'undefined'. Just delete instead.
        delete process.env.DEBUG;
    }
}
/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */ function load() {
    return process.env.DEBUG;
}
/**
 * Init logic for `debug` instances.
 *
 * Create a new `inspectOpts` object in case `useColors` is set
 * differently for a particular `debug` instance.
 */ function init(debug) {
    debug.inspectOpts = {};
    const keys = Object.keys(exports.inspectOpts);
    for(let i = 0; i < keys.length; i++){
        debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
    }
}
module.exports = __turbopack_context__.r("[project]/node_modules/debug/src/common.js [app-route] (ecmascript)")(exports);
const { formatters } = module.exports;
/**
 * Map %o to `util.inspect()`, all on a single line.
 */ formatters.o = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util.inspect(v, this.inspectOpts).split('\n').map((str)=>str.trim()).join(' ');
};
/**
 * Map %O to `util.inspect()`, allowing multiple lines if needed.
 */ formatters.O = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util.inspect(v, this.inspectOpts);
};
}),
"[project]/node_modules/debug/src/browser.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/* eslint-env browser */ /**
 * This is the web browser implementation of `debug()`.
 */ exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = localstorage();
exports.destroy = (()=>{
    let warned = false;
    return ()=>{
        if (!warned) {
            warned = true;
            console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
        }
    };
})();
/**
 * Colors.
 */ exports.colors = [
    '#0000CC',
    '#0000FF',
    '#0033CC',
    '#0033FF',
    '#0066CC',
    '#0066FF',
    '#0099CC',
    '#0099FF',
    '#00CC00',
    '#00CC33',
    '#00CC66',
    '#00CC99',
    '#00CCCC',
    '#00CCFF',
    '#3300CC',
    '#3300FF',
    '#3333CC',
    '#3333FF',
    '#3366CC',
    '#3366FF',
    '#3399CC',
    '#3399FF',
    '#33CC00',
    '#33CC33',
    '#33CC66',
    '#33CC99',
    '#33CCCC',
    '#33CCFF',
    '#6600CC',
    '#6600FF',
    '#6633CC',
    '#6633FF',
    '#66CC00',
    '#66CC33',
    '#9900CC',
    '#9900FF',
    '#9933CC',
    '#9933FF',
    '#99CC00',
    '#99CC33',
    '#CC0000',
    '#CC0033',
    '#CC0066',
    '#CC0099',
    '#CC00CC',
    '#CC00FF',
    '#CC3300',
    '#CC3333',
    '#CC3366',
    '#CC3399',
    '#CC33CC',
    '#CC33FF',
    '#CC6600',
    '#CC6633',
    '#CC9900',
    '#CC9933',
    '#CCCC00',
    '#CCCC33',
    '#FF0000',
    '#FF0033',
    '#FF0066',
    '#FF0099',
    '#FF00CC',
    '#FF00FF',
    '#FF3300',
    '#FF3333',
    '#FF3366',
    '#FF3399',
    '#FF33CC',
    '#FF33FF',
    '#FF6600',
    '#FF6633',
    '#FF9900',
    '#FF9933',
    '#FFCC00',
    '#FFCC33'
];
/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */ // eslint-disable-next-line complexity
function useColors() {
    // NB: In an Electron preload script, document will be defined but not fully
    // initialized. Since we know we're in Chrome, we'll just detect this case
    // explicitly
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    // Internet Explorer and Edge do not support colors.
    if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
    }
    let m;
    // Is webkit? http://stackoverflow.com/a/16459606/376773
    // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
    // eslint-disable-next-line no-return-assign
    return typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || ("TURBOPACK compile-time value", "undefined") !== 'undefined' && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== 'undefined' && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
}
/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */ function formatArgs(args) {
    args[0] = (this.useColors ? '%c' : '') + this.namespace + (this.useColors ? ' %c' : ' ') + args[0] + (this.useColors ? '%c ' : ' ') + '+' + module.exports.humanize(this.diff);
    if (!this.useColors) {
        return;
    }
    const c = 'color: ' + this.color;
    args.splice(1, 0, c, 'color: inherit');
    // The final "%c" is somewhat tricky, because there could be other
    // arguments passed either before or after the %c, so we need to
    // figure out the correct index to insert the CSS into
    let index = 0;
    let lastC = 0;
    args[0].replace(/%[a-zA-Z%]/g, (match)=>{
        if (match === '%%') {
            return;
        }
        index++;
        if (match === '%c') {
            // We only are interested in the *last* %c
            // (the user may have provided their own)
            lastC = index;
        }
    });
    args.splice(lastC, 0, c);
}
/**
 * Invokes `console.debug()` when available.
 * No-op when `console.debug` is not a "function".
 * If `console.debug` is not available, falls back
 * to `console.log`.
 *
 * @api public
 */ exports.log = console.debug || console.log || (()=>{});
/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */ function save(namespaces) {
    try {
        if (namespaces) {
            exports.storage.setItem('debug', namespaces);
        } else {
            exports.storage.removeItem('debug');
        }
    } catch (error) {
    // Swallow
    // XXX (@Qix-) should we be logging these?
    }
}
/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */ function load() {
    let r;
    try {
        r = exports.storage.getItem('debug') || exports.storage.getItem('DEBUG');
    } catch (error) {
    // Swallow
    // XXX (@Qix-) should we be logging these?
    }
    // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
    if (!r && typeof process !== 'undefined' && 'env' in process) {
        r = process.env.DEBUG;
    }
    return r;
}
/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */ function localstorage() {
    try {
        // TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
        // The Browser also has localStorage in the global context.
        return localStorage;
    } catch (error) {
    // Swallow
    // XXX (@Qix-) should we be logging these?
    }
}
module.exports = __turbopack_context__.r("[project]/node_modules/debug/src/common.js [app-route] (ecmascript)")(exports);
const { formatters } = module.exports;
/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */ formatters.j = function(v) {
    try {
        return JSON.stringify(v);
    } catch (error) {
        return '[UnexpectedJSONParseError]: ' + error.message;
    }
};
}),
"[project]/node_modules/debug/src/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/**
 * Detect Electron renderer / nwjs process, which is node, but we should
 * treat as a browser.
 */ if (typeof process === 'undefined' || process.type === 'renderer' || ("TURBOPACK compile-time value", false) === true || process.__nwjs) {
    module.exports = __turbopack_context__.r("[project]/node_modules/debug/src/browser.js [app-route] (ecmascript)");
} else {
    module.exports = __turbopack_context__.r("[project]/node_modules/debug/src/node.js [app-route] (ecmascript)");
}
}),
"[project]/node_modules/has-flag/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

module.exports = (flag, argv = process.argv)=>{
    const prefix = flag.startsWith('-') ? '' : flag.length === 1 ? '-' : '--';
    const position = argv.indexOf(prefix + flag);
    const terminatorPosition = argv.indexOf('--');
    return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
};
}),
"[project]/node_modules/supports-color/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

const os = __turbopack_context__.r("[externals]/os [external] (os, cjs)");
const tty = __turbopack_context__.r("[externals]/tty [external] (tty, cjs)");
const hasFlag = __turbopack_context__.r("[project]/node_modules/has-flag/index.js [app-route] (ecmascript)");
const { env } = process;
let forceColor;
if (hasFlag('no-color') || hasFlag('no-colors') || hasFlag('color=false') || hasFlag('color=never')) {
    forceColor = 0;
} else if (hasFlag('color') || hasFlag('colors') || hasFlag('color=true') || hasFlag('color=always')) {
    forceColor = 1;
}
if ('FORCE_COLOR' in env) {
    if (env.FORCE_COLOR === 'true') {
        forceColor = 1;
    } else if (env.FORCE_COLOR === 'false') {
        forceColor = 0;
    } else {
        forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
    }
}
function translateLevel(level) {
    if (level === 0) {
        return false;
    }
    return {
        level,
        hasBasic: true,
        has256: level >= 2,
        has16m: level >= 3
    };
}
function supportsColor(haveStream, streamIsTTY) {
    if (forceColor === 0) {
        return 0;
    }
    if (hasFlag('color=16m') || hasFlag('color=full') || hasFlag('color=truecolor')) {
        return 3;
    }
    if (hasFlag('color=256')) {
        return 2;
    }
    if (haveStream && !streamIsTTY && forceColor === undefined) {
        return 0;
    }
    const min = forceColor || 0;
    if (env.TERM === 'dumb') {
        return min;
    }
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    if ('CI' in env) {
        if ([
            'TRAVIS',
            'CIRCLECI',
            'APPVEYOR',
            'GITLAB_CI',
            'GITHUB_ACTIONS',
            'BUILDKITE'
        ].some((sign)=>sign in env) || env.CI_NAME === 'codeship') {
            return 1;
        }
        return min;
    }
    if ('TEAMCITY_VERSION' in env) {
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
    }
    if (env.COLORTERM === 'truecolor') {
        return 3;
    }
    if ('TERM_PROGRAM' in env) {
        const version = parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);
        switch(env.TERM_PROGRAM){
            case 'iTerm.app':
                return version >= 3 ? 3 : 2;
            case 'Apple_Terminal':
                return 2;
        }
    }
    if (/-256(color)?$/i.test(env.TERM)) {
        return 2;
    }
    if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
        return 1;
    }
    if ('COLORTERM' in env) {
        return 1;
    }
    return min;
}
function getSupportLevel(stream) {
    const level = supportsColor(stream, stream && stream.isTTY);
    return translateLevel(level);
}
module.exports = {
    supportsColor: getSupportLevel,
    stdout: translateLevel(supportsColor(true, tty.isatty(1))),
    stderr: translateLevel(supportsColor(true, tty.isatty(2)))
};
}),
"[project]/node_modules/denque/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/**
 * Custom implementation of a double ended queue.
 */ function Denque(array, options) {
    var options = options || {};
    this._capacity = options.capacity;
    this._head = 0;
    this._tail = 0;
    if (Array.isArray(array)) {
        this._fromArray(array);
    } else {
        this._capacityMask = 0x3;
        this._list = new Array(4);
    }
}
/**
 * --------------
 *  PUBLIC API
 * -------------
 */ /**
 * Returns the item at the specified index from the list.
 * 0 is the first element, 1 is the second, and so on...
 * Elements at negative values are that many from the end: -1 is one before the end
 * (the last element), -2 is two before the end (one before last), etc.
 * @param index
 * @returns {*}
 */ Denque.prototype.peekAt = function peekAt(index) {
    var i = index;
    // expect a number or return undefined
    if (i !== (i | 0)) {
        return void 0;
    }
    var len = this.size();
    if (i >= len || i < -len) return undefined;
    if (i < 0) i += len;
    i = this._head + i & this._capacityMask;
    return this._list[i];
};
/**
 * Alias for peekAt()
 * @param i
 * @returns {*}
 */ Denque.prototype.get = function get(i) {
    return this.peekAt(i);
};
/**
 * Returns the first item in the list without removing it.
 * @returns {*}
 */ Denque.prototype.peek = function peek() {
    if (this._head === this._tail) return undefined;
    return this._list[this._head];
};
/**
 * Alias for peek()
 * @returns {*}
 */ Denque.prototype.peekFront = function peekFront() {
    return this.peek();
};
/**
 * Returns the item that is at the back of the queue without removing it.
 * Uses peekAt(-1)
 */ Denque.prototype.peekBack = function peekBack() {
    return this.peekAt(-1);
};
/**
 * Returns the current length of the queue
 * @return {Number}
 */ Object.defineProperty(Denque.prototype, 'length', {
    get: function length() {
        return this.size();
    }
});
/**
 * Return the number of items on the list, or 0 if empty.
 * @returns {number}
 */ Denque.prototype.size = function size() {
    if (this._head === this._tail) return 0;
    if (this._head < this._tail) return this._tail - this._head;
    else return this._capacityMask + 1 - (this._head - this._tail);
};
/**
 * Add an item at the beginning of the list.
 * @param item
 */ Denque.prototype.unshift = function unshift(item) {
    if (arguments.length === 0) return this.size();
    var len = this._list.length;
    this._head = this._head - 1 + len & this._capacityMask;
    this._list[this._head] = item;
    if (this._tail === this._head) this._growArray();
    if (this._capacity && this.size() > this._capacity) this.pop();
    if (this._head < this._tail) return this._tail - this._head;
    else return this._capacityMask + 1 - (this._head - this._tail);
};
/**
 * Remove and return the first item on the list,
 * Returns undefined if the list is empty.
 * @returns {*}
 */ Denque.prototype.shift = function shift() {
    var head = this._head;
    if (head === this._tail) return undefined;
    var item = this._list[head];
    this._list[head] = undefined;
    this._head = head + 1 & this._capacityMask;
    if (head < 2 && this._tail > 10000 && this._tail <= this._list.length >>> 2) this._shrinkArray();
    return item;
};
/**
 * Add an item to the bottom of the list.
 * @param item
 */ Denque.prototype.push = function push(item) {
    if (arguments.length === 0) return this.size();
    var tail = this._tail;
    this._list[tail] = item;
    this._tail = tail + 1 & this._capacityMask;
    if (this._tail === this._head) {
        this._growArray();
    }
    if (this._capacity && this.size() > this._capacity) {
        this.shift();
    }
    if (this._head < this._tail) return this._tail - this._head;
    else return this._capacityMask + 1 - (this._head - this._tail);
};
/**
 * Remove and return the last item on the list.
 * Returns undefined if the list is empty.
 * @returns {*}
 */ Denque.prototype.pop = function pop() {
    var tail = this._tail;
    if (tail === this._head) return undefined;
    var len = this._list.length;
    this._tail = tail - 1 + len & this._capacityMask;
    var item = this._list[this._tail];
    this._list[this._tail] = undefined;
    if (this._head < 2 && tail > 10000 && tail <= len >>> 2) this._shrinkArray();
    return item;
};
/**
 * Remove and return the item at the specified index from the list.
 * Returns undefined if the list is empty.
 * @param index
 * @returns {*}
 */ Denque.prototype.removeOne = function removeOne(index) {
    var i = index;
    // expect a number or return undefined
    if (i !== (i | 0)) {
        return void 0;
    }
    if (this._head === this._tail) return void 0;
    var size = this.size();
    var len = this._list.length;
    if (i >= size || i < -size) return void 0;
    if (i < 0) i += size;
    i = this._head + i & this._capacityMask;
    var item = this._list[i];
    var k;
    if (index < size / 2) {
        for(k = index; k > 0; k--){
            this._list[i] = this._list[i = i - 1 + len & this._capacityMask];
        }
        this._list[i] = void 0;
        this._head = this._head + 1 + len & this._capacityMask;
    } else {
        for(k = size - 1 - index; k > 0; k--){
            this._list[i] = this._list[i = i + 1 + len & this._capacityMask];
        }
        this._list[i] = void 0;
        this._tail = this._tail - 1 + len & this._capacityMask;
    }
    return item;
};
/**
 * Remove number of items from the specified index from the list.
 * Returns array of removed items.
 * Returns undefined if the list is empty.
 * @param index
 * @param count
 * @returns {array}
 */ Denque.prototype.remove = function remove(index, count) {
    var i = index;
    var removed;
    var del_count = count;
    // expect a number or return undefined
    if (i !== (i | 0)) {
        return void 0;
    }
    if (this._head === this._tail) return void 0;
    var size = this.size();
    var len = this._list.length;
    if (i >= size || i < -size || count < 1) return void 0;
    if (i < 0) i += size;
    if (count === 1 || !count) {
        removed = new Array(1);
        removed[0] = this.removeOne(i);
        return removed;
    }
    if (i === 0 && i + count >= size) {
        removed = this.toArray();
        this.clear();
        return removed;
    }
    if (i + count > size) count = size - i;
    var k;
    removed = new Array(count);
    for(k = 0; k < count; k++){
        removed[k] = this._list[this._head + i + k & this._capacityMask];
    }
    i = this._head + i & this._capacityMask;
    if (index + count === size) {
        this._tail = this._tail - count + len & this._capacityMask;
        for(k = count; k > 0; k--){
            this._list[i = i + 1 + len & this._capacityMask] = void 0;
        }
        return removed;
    }
    if (index === 0) {
        this._head = this._head + count + len & this._capacityMask;
        for(k = count - 1; k > 0; k--){
            this._list[i = i + 1 + len & this._capacityMask] = void 0;
        }
        return removed;
    }
    if (i < size / 2) {
        this._head = this._head + index + count + len & this._capacityMask;
        for(k = index; k > 0; k--){
            this.unshift(this._list[i = i - 1 + len & this._capacityMask]);
        }
        i = this._head - 1 + len & this._capacityMask;
        while(del_count > 0){
            this._list[i = i - 1 + len & this._capacityMask] = void 0;
            del_count--;
        }
        if (index < 0) this._tail = i;
    } else {
        this._tail = i;
        i = i + count + len & this._capacityMask;
        for(k = size - (count + index); k > 0; k--){
            this.push(this._list[i++]);
        }
        i = this._tail;
        while(del_count > 0){
            this._list[i = i + 1 + len & this._capacityMask] = void 0;
            del_count--;
        }
    }
    if (this._head < 2 && this._tail > 10000 && this._tail <= len >>> 2) this._shrinkArray();
    return removed;
};
/**
 * Native splice implementation.
 * Remove number of items from the specified index from the list and/or add new elements.
 * Returns array of removed items or empty array if count == 0.
 * Returns undefined if the list is empty.
 *
 * @param index
 * @param count
 * @param {...*} [elements]
 * @returns {array}
 */ Denque.prototype.splice = function splice(index, count) {
    var i = index;
    // expect a number or return undefined
    if (i !== (i | 0)) {
        return void 0;
    }
    var size = this.size();
    if (i < 0) i += size;
    if (i > size) return void 0;
    if (arguments.length > 2) {
        var k;
        var temp;
        var removed;
        var arg_len = arguments.length;
        var len = this._list.length;
        var arguments_index = 2;
        if (!size || i < size / 2) {
            temp = new Array(i);
            for(k = 0; k < i; k++){
                temp[k] = this._list[this._head + k & this._capacityMask];
            }
            if (count === 0) {
                removed = [];
                if (i > 0) {
                    this._head = this._head + i + len & this._capacityMask;
                }
            } else {
                removed = this.remove(i, count);
                this._head = this._head + i + len & this._capacityMask;
            }
            while(arg_len > arguments_index){
                this.unshift(arguments[--arg_len]);
            }
            for(k = i; k > 0; k--){
                this.unshift(temp[k - 1]);
            }
        } else {
            temp = new Array(size - (i + count));
            var leng = temp.length;
            for(k = 0; k < leng; k++){
                temp[k] = this._list[this._head + i + count + k & this._capacityMask];
            }
            if (count === 0) {
                removed = [];
                if (i != size) {
                    this._tail = this._head + i + len & this._capacityMask;
                }
            } else {
                removed = this.remove(i, count);
                this._tail = this._tail - leng + len & this._capacityMask;
            }
            while(arguments_index < arg_len){
                this.push(arguments[arguments_index++]);
            }
            for(k = 0; k < leng; k++){
                this.push(temp[k]);
            }
        }
        return removed;
    } else {
        return this.remove(i, count);
    }
};
/**
 * Soft clear - does not reset capacity.
 */ Denque.prototype.clear = function clear() {
    this._list = new Array(this._list.length);
    this._head = 0;
    this._tail = 0;
};
/**
 * Returns true or false whether the list is empty.
 * @returns {boolean}
 */ Denque.prototype.isEmpty = function isEmpty() {
    return this._head === this._tail;
};
/**
 * Returns an array of all queue items.
 * @returns {Array}
 */ Denque.prototype.toArray = function toArray() {
    return this._copyArray(false);
};
/**
 * -------------
 *   INTERNALS
 * -------------
 */ /**
 * Fills the queue with items from an array
 * For use in the constructor
 * @param array
 * @private
 */ Denque.prototype._fromArray = function _fromArray(array) {
    var length = array.length;
    var capacity = this._nextPowerOf2(length);
    this._list = new Array(capacity);
    this._capacityMask = capacity - 1;
    this._tail = length;
    for(var i = 0; i < length; i++)this._list[i] = array[i];
};
/**
 *
 * @param fullCopy
 * @param size Initialize the array with a specific size. Will default to the current list size
 * @returns {Array}
 * @private
 */ Denque.prototype._copyArray = function _copyArray(fullCopy, size) {
    var src = this._list;
    var capacity = src.length;
    var length = this.length;
    size = size | length;
    // No prealloc requested and the buffer is contiguous
    if (size == length && this._head < this._tail) {
        // Simply do a fast slice copy
        return this._list.slice(this._head, this._tail);
    }
    var dest = new Array(size);
    var k = 0;
    var i;
    if (fullCopy || this._head > this._tail) {
        for(i = this._head; i < capacity; i++)dest[k++] = src[i];
        for(i = 0; i < this._tail; i++)dest[k++] = src[i];
    } else {
        for(i = this._head; i < this._tail; i++)dest[k++] = src[i];
    }
    return dest;
};
/**
 * Grows the internal list array.
 * @private
 */ Denque.prototype._growArray = function _growArray() {
    if (this._head != 0) {
        // double array size and copy existing data, head to end, then beginning to tail.
        var newList = this._copyArray(true, this._list.length << 1);
        this._tail = this._list.length;
        this._head = 0;
        this._list = newList;
    } else {
        this._tail = this._list.length;
        this._list.length <<= 1;
    }
    this._capacityMask = this._capacityMask << 1 | 1;
};
/**
 * Shrinks the internal list array.
 * @private
 */ Denque.prototype._shrinkArray = function _shrinkArray() {
    this._list.length >>>= 1;
    this._capacityMask >>>= 1;
};
/**
 * Find the next power of 2, at least 4
 * @private
 * @param {number} num 
 * @returns {number}
 */ Denque.prototype._nextPowerOf2 = function _nextPowerOf2(num) {
    var log2 = Math.log(num) / Math.log(2);
    var nextPow2 = 1 << log2 + 1;
    return Math.max(nextPow2, 4);
};
module.exports = Denque;
}),
"[project]/node_modules/@ioredis/as-callback/built/utils.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.tryCatch = exports.errorObj = void 0;
//Try catch is not supported in optimizing
//compiler, so it is isolated
exports.errorObj = {
    e: {}
};
let tryCatchTarget;
function tryCatcher(err, val) {
    try {
        const target = tryCatchTarget;
        tryCatchTarget = null;
        return target.apply(this, arguments);
    } catch (e) {
        exports.errorObj.e = e;
        return exports.errorObj;
    }
}
function tryCatch(fn) {
    tryCatchTarget = fn;
    return tryCatcher;
}
exports.tryCatch = tryCatch;
}),
"[project]/node_modules/@ioredis/as-callback/built/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
const utils_1 = __turbopack_context__.r("[project]/node_modules/@ioredis/as-callback/built/utils.js [app-route] (ecmascript)");
function throwLater(e) {
    setTimeout(function() {
        throw e;
    }, 0);
}
function asCallback(promise, nodeback, options) {
    if (typeof nodeback === "function") {
        promise.then((val)=>{
            let ret;
            if (options !== undefined && Object(options).spread && Array.isArray(val)) {
                ret = (0, utils_1.tryCatch)(nodeback).apply(undefined, [
                    null
                ].concat(val));
            } else {
                ret = val === undefined ? (0, utils_1.tryCatch)(nodeback)(null) : (0, utils_1.tryCatch)(nodeback)(null, val);
            }
            if (ret === utils_1.errorObj) {
                throwLater(ret.e);
            }
        }, (cause)=>{
            if (!cause) {
                const newReason = new Error(cause + "");
                Object.assign(newReason, {
                    cause
                });
                cause = newReason;
            }
            const ret = (0, utils_1.tryCatch)(nodeback)(cause);
            if (ret === utils_1.errorObj) {
                throwLater(ret.e);
            }
        });
    }
    return promise;
}
exports.default = asCallback;
}),
"[project]/node_modules/tmp/lib/tmp.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/*!
 * Tmp
 *
 * Copyright (c) 2011-2017 KARASZI Istvan <github@spam.raszi.hu>
 *
 * MIT Licensed
 */ /*
 * Module dependencies.
 */ const fs = __turbopack_context__.r("[externals]/fs [external] (fs, cjs)");
const os = __turbopack_context__.r("[externals]/os [external] (os, cjs)");
const path = __turbopack_context__.r("[externals]/path [external] (path, cjs)");
const crypto = __turbopack_context__.r("[externals]/crypto [external] (crypto, cjs)");
const _c = {
    fs: fs.constants,
    os: os.constants
};
/*
 * The working inner variables.
 */ const RANDOM_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', TEMPLATE_PATTERN = /XXXXXX/, DEFAULT_TRIES = 3, CREATE_FLAGS = (_c.O_CREAT || _c.fs.O_CREAT) | (_c.O_EXCL || _c.fs.O_EXCL) | (_c.O_RDWR || _c.fs.O_RDWR), // constants are off on the windows platform and will not match the actual errno codes
IS_WIN32 = os.platform() === 'win32', EBADF = _c.EBADF || _c.os.errno.EBADF, ENOENT = _c.ENOENT || _c.os.errno.ENOENT, DIR_MODE = 0o700 /* 448 */ , FILE_MODE = 0o600 /* 384 */ , EXIT = 'exit', // this will hold the objects need to be removed on exit
_removeObjects = [], // API change in fs.rmdirSync leads to error when passing in a second parameter, e.g. the callback
FN_RMDIR_SYNC = fs.rmdirSync.bind(fs);
let _gracefulCleanup = false;
/**
 * Recursively remove a directory and its contents.
 *
 * @param {string} dirPath path of directory to remove
 * @param {Function} callback
 * @private
 */ function rimraf(dirPath, callback) {
    return fs.rm(dirPath, {
        recursive: true
    }, callback);
}
/**
 * Recursively remove a directory and its contents, synchronously.
 *
 * @param {string} dirPath path of directory to remove
 * @private
 */ function FN_RIMRAF_SYNC(dirPath) {
    return fs.rmSync(dirPath, {
        recursive: true
    });
}
/**
 * Gets a temporary file name.
 *
 * @param {(Options|tmpNameCallback)} options options or callback
 * @param {?tmpNameCallback} callback the callback function
 */ function tmpName(options, callback) {
    const args = _parseArguments(options, callback), opts = args[0], cb = args[1];
    _assertAndSanitizeOptions(opts, function(err, sanitizedOptions) {
        if (err) return cb(err);
        let tries = sanitizedOptions.tries;
        (function _getUniqueName() {
            try {
                const name = _generateTmpName(sanitizedOptions);
                // check whether the path exists then retry if needed
                fs.stat(name, function(err) {
                    /* istanbul ignore else */ if (!err) {
                        /* istanbul ignore else */ if (tries-- > 0) return _getUniqueName();
                        return cb(new Error('Could not get a unique tmp filename, max tries reached ' + name));
                    }
                    cb(null, name);
                });
            } catch (err) {
                cb(err);
            }
        })();
    });
}
/**
 * Synchronous version of tmpName.
 *
 * @param {Object} options
 * @returns {string} the generated random name
 * @throws {Error} if the options are invalid or could not generate a filename
 */ function tmpNameSync(options) {
    const args = _parseArguments(options), opts = args[0];
    const sanitizedOptions = _assertAndSanitizeOptionsSync(opts);
    let tries = sanitizedOptions.tries;
    do {
        const name = _generateTmpName(sanitizedOptions);
        try {
            fs.statSync(name);
        } catch (e) {
            return name;
        }
    }while (tries-- > 0)
    throw new Error('Could not get a unique tmp filename, max tries reached');
}
/**
 * Creates and opens a temporary file.
 *
 * @param {(Options|null|undefined|fileCallback)} options the config options or the callback function or null or undefined
 * @param {?fileCallback} callback
 */ function file(options, callback) {
    const args = _parseArguments(options, callback), opts = args[0], cb = args[1];
    // gets a temporary filename
    tmpName(opts, function _tmpNameCreated(err, name) {
        /* istanbul ignore else */ if (err) return cb(err);
        // create and open the file
        fs.open(name, CREATE_FLAGS, opts.mode || FILE_MODE, function _fileCreated(err, fd) {
            /* istanbu ignore else */ if (err) return cb(err);
            if (opts.discardDescriptor) {
                return fs.close(fd, function _discardCallback(possibleErr) {
                    // the chance of getting an error on close here is rather low and might occur in the most edgiest cases only
                    return cb(possibleErr, name, undefined, _prepareTmpFileRemoveCallback(name, -1, opts, false));
                });
            } else {
                // detachDescriptor passes the descriptor whereas discardDescriptor closes it, either way, we no longer care
                // about the descriptor
                const discardOrDetachDescriptor = opts.discardDescriptor || opts.detachDescriptor;
                cb(null, name, fd, _prepareTmpFileRemoveCallback(name, discardOrDetachDescriptor ? -1 : fd, opts, false));
            }
        });
    });
}
/**
 * Synchronous version of file.
 *
 * @param {Options} options
 * @returns {FileSyncObject} object consists of name, fd and removeCallback
 * @throws {Error} if cannot create a file
 */ function fileSync(options) {
    const args = _parseArguments(options), opts = args[0];
    const discardOrDetachDescriptor = opts.discardDescriptor || opts.detachDescriptor;
    const name = tmpNameSync(opts);
    let fd = fs.openSync(name, CREATE_FLAGS, opts.mode || FILE_MODE);
    /* istanbul ignore else */ if (opts.discardDescriptor) {
        fs.closeSync(fd);
        fd = undefined;
    }
    return {
        name: name,
        fd: fd,
        removeCallback: _prepareTmpFileRemoveCallback(name, discardOrDetachDescriptor ? -1 : fd, opts, true)
    };
}
/**
 * Creates a temporary directory.
 *
 * @param {(Options|dirCallback)} options the options or the callback function
 * @param {?dirCallback} callback
 */ function dir(options, callback) {
    const args = _parseArguments(options, callback), opts = args[0], cb = args[1];
    // gets a temporary filename
    tmpName(opts, function _tmpNameCreated(err, name) {
        /* istanbul ignore else */ if (err) return cb(err);
        // create the directory
        fs.mkdir(name, opts.mode || DIR_MODE, function _dirCreated(err) {
            /* istanbul ignore else */ if (err) return cb(err);
            cb(null, name, _prepareTmpDirRemoveCallback(name, opts, false));
        });
    });
}
/**
 * Synchronous version of dir.
 *
 * @param {Options} options
 * @returns {DirSyncObject} object consists of name and removeCallback
 * @throws {Error} if it cannot create a directory
 */ function dirSync(options) {
    const args = _parseArguments(options), opts = args[0];
    const name = tmpNameSync(opts);
    fs.mkdirSync(name, opts.mode || DIR_MODE);
    return {
        name: name,
        removeCallback: _prepareTmpDirRemoveCallback(name, opts, true)
    };
}
/**
 * Removes files asynchronously.
 *
 * @param {Object} fdPath
 * @param {Function} next
 * @private
 */ function _removeFileAsync(fdPath, next) {
    const _handler = function(err) {
        if (err && !_isENOENT(err)) {
            // reraise any unanticipated error
            return next(err);
        }
        next();
    };
    if (0 <= fdPath[0]) fs.close(fdPath[0], function() {
        fs.unlink(fdPath[1], _handler);
    });
    else fs.unlink(fdPath[1], _handler);
}
/**
 * Removes files synchronously.
 *
 * @param {Object} fdPath
 * @private
 */ function _removeFileSync(fdPath) {
    let rethrownException = null;
    try {
        if (0 <= fdPath[0]) fs.closeSync(fdPath[0]);
    } catch (e) {
        // reraise any unanticipated error
        if (!_isEBADF(e) && !_isENOENT(e)) throw e;
    } finally{
        try {
            fs.unlinkSync(fdPath[1]);
        } catch (e) {
            // reraise any unanticipated error
            if (!_isENOENT(e)) rethrownException = e;
        }
    }
    if (rethrownException !== null) {
        throw rethrownException;
    }
}
/**
 * Prepares the callback for removal of the temporary file.
 *
 * Returns either a sync callback or a async callback depending on whether
 * fileSync or file was called, which is expressed by the sync parameter.
 *
 * @param {string} name the path of the file
 * @param {number} fd file descriptor
 * @param {Object} opts
 * @param {boolean} sync
 * @returns {fileCallback | fileCallbackSync}
 * @private
 */ function _prepareTmpFileRemoveCallback(name, fd, opts, sync) {
    const removeCallbackSync = _prepareRemoveCallback(_removeFileSync, [
        fd,
        name
    ], sync);
    const removeCallback = _prepareRemoveCallback(_removeFileAsync, [
        fd,
        name
    ], sync, removeCallbackSync);
    if (!opts.keep) _removeObjects.unshift(removeCallbackSync);
    return sync ? removeCallbackSync : removeCallback;
}
/**
 * Prepares the callback for removal of the temporary directory.
 *
 * Returns either a sync callback or a async callback depending on whether
 * tmpFileSync or tmpFile was called, which is expressed by the sync parameter.
 *
 * @param {string} name
 * @param {Object} opts
 * @param {boolean} sync
 * @returns {Function} the callback
 * @private
 */ function _prepareTmpDirRemoveCallback(name, opts, sync) {
    const removeFunction = opts.unsafeCleanup ? rimraf : fs.rmdir.bind(fs);
    const removeFunctionSync = opts.unsafeCleanup ? FN_RIMRAF_SYNC : FN_RMDIR_SYNC;
    const removeCallbackSync = _prepareRemoveCallback(removeFunctionSync, name, sync);
    const removeCallback = _prepareRemoveCallback(removeFunction, name, sync, removeCallbackSync);
    if (!opts.keep) _removeObjects.unshift(removeCallbackSync);
    return sync ? removeCallbackSync : removeCallback;
}
/**
 * Creates a guarded function wrapping the removeFunction call.
 *
 * The cleanup callback is save to be called multiple times.
 * Subsequent invocations will be ignored.
 *
 * @param {Function} removeFunction
 * @param {string} fileOrDirName
 * @param {boolean} sync
 * @param {cleanupCallbackSync?} cleanupCallbackSync
 * @returns {cleanupCallback | cleanupCallbackSync}
 * @private
 */ function _prepareRemoveCallback(removeFunction, fileOrDirName, sync, cleanupCallbackSync) {
    let called = false;
    // if sync is true, the next parameter will be ignored
    return function _cleanupCallback(next) {
        /* istanbul ignore else */ if (!called) {
            // remove cleanupCallback from cache
            const toRemove = cleanupCallbackSync || _cleanupCallback;
            const index = _removeObjects.indexOf(toRemove);
            /* istanbul ignore else */ if (index >= 0) _removeObjects.splice(index, 1);
            called = true;
            if (sync || removeFunction === FN_RMDIR_SYNC || removeFunction === FN_RIMRAF_SYNC) {
                return removeFunction(fileOrDirName);
            } else {
                return removeFunction(fileOrDirName, next || function() {});
            }
        }
    };
}
/**
 * The garbage collector.
 *
 * @private
 */ function _garbageCollector() {
    /* istanbul ignore else */ if (!_gracefulCleanup) return;
    // the function being called removes itself from _removeObjects,
    // loop until _removeObjects is empty
    while(_removeObjects.length){
        try {
            _removeObjects[0]();
        } catch (e) {
        // already removed?
        }
    }
}
/**
 * Random name generator based on crypto.
 * Adapted from http://blog.tompawlak.org/how-to-generate-random-values-nodejs-javascript
 *
 * @param {number} howMany
 * @returns {string} the generated random name
 * @private
 */ function _randomChars(howMany) {
    let value = [], rnd = null;
    // make sure that we do not fail because we ran out of entropy
    try {
        rnd = crypto.randomBytes(howMany);
    } catch (e) {
        rnd = crypto.pseudoRandomBytes(howMany);
    }
    for(let i = 0; i < howMany; i++){
        value.push(RANDOM_CHARS[rnd[i] % RANDOM_CHARS.length]);
    }
    return value.join('');
}
/**
 * Checks whether the `obj` parameter is defined or not.
 *
 * @param {Object} obj
 * @returns {boolean} true if the object is undefined
 * @private
 */ function _isUndefined(obj) {
    return typeof obj === 'undefined';
}
/**
 * Parses the function arguments.
 *
 * This function helps to have optional arguments.
 *
 * @param {(Options|null|undefined|Function)} options
 * @param {?Function} callback
 * @returns {Array} parsed arguments
 * @private
 */ function _parseArguments(options, callback) {
    /* istanbul ignore else */ if (typeof options === 'function') {
        return [
            {},
            options
        ];
    }
    /* istanbul ignore else */ if (_isUndefined(options)) {
        return [
            {},
            callback
        ];
    }
    // copy options so we do not leak the changes we make internally
    const actualOptions = {};
    for (const key of Object.getOwnPropertyNames(options)){
        actualOptions[key] = options[key];
    }
    return [
        actualOptions,
        callback
    ];
}
/**
 * Resolve the specified path name in respect to tmpDir.
 *
 * The specified name might include relative path components, e.g. ../
 * so we need to resolve in order to be sure that is is located inside tmpDir
 *
 * @private
 */ function _resolvePath(name, tmpDir, cb) {
    const pathToResolve = path.isAbsolute(name) ? name : path.join(tmpDir, name);
    fs.stat(pathToResolve, function(err) {
        if (err) {
            fs.realpath(path.dirname(pathToResolve), function(err, parentDir) {
                if (err) return cb(err);
                cb(null, path.join(parentDir, path.basename(pathToResolve)));
            });
        } else {
            fs.realpath(pathToResolve, cb);
        }
    });
}
/**
 * Resolve the specified path name in respect to tmpDir.
 *
 * The specified name might include relative path components, e.g. ../
 * so we need to resolve in order to be sure that is is located inside tmpDir
 *
 * @private
 */ function _resolvePathSync(name, tmpDir) {
    const pathToResolve = path.isAbsolute(name) ? name : path.join(tmpDir, name);
    try {
        fs.statSync(pathToResolve);
        return fs.realpathSync(pathToResolve);
    } catch (_err) {
        const parentDir = fs.realpathSync(path.dirname(pathToResolve));
        return path.join(parentDir, path.basename(pathToResolve));
    }
}
/**
 * Generates a new temporary name.
 *
 * @param {Object} opts
 * @returns {string} the new random name according to opts
 * @private
 */ function _generateTmpName(opts) {
    const tmpDir = opts.tmpdir;
    /* istanbul ignore else */ if (!_isUndefined(opts.name)) {
        return path.join(tmpDir, opts.dir, opts.name);
    }
    /* istanbul ignore else */ if (!_isUndefined(opts.template)) {
        return path.join(tmpDir, opts.dir, opts.template).replace(TEMPLATE_PATTERN, _randomChars(6));
    }
    // prefix and postfix
    const name = [
        opts.prefix ? opts.prefix : 'tmp',
        '-',
        process.pid,
        '-',
        _randomChars(12),
        opts.postfix ? '-' + opts.postfix : ''
    ].join('');
    return path.join(tmpDir, opts.dir, name);
}
/**
 * Check the prefix, postfix, and template options.
 *
 * Rejects non-string inputs so that a non-string `.includes('..')` cannot evade
 * the substring check (e.g. an Array whose `.includes('..')` is element-wise,
 * or a duck-typed object with a custom `.includes`), and so that the value is
 * not later coerced to a string with traversal sequences via `Array.prototype.join`
 * or `path.join`.
 *
 * @private
 */ function _assertPath(option, value) {
    if (typeof value !== 'string') {
        throw new Error(`${option} option must be a string, got "${typeof value}".`);
    }
    if (value.includes("..")) {
        throw new Error("Relative value not allowed");
    }
    return value;
}
/**
 * Asserts and sanitizes the basic options.
 *
 * @private
 */ function _assertOptionsBase(options) {
    if (!_isUndefined(options.name)) {
        const name = options.name;
        // assert that name is not absolute and does not contain a path
        if (path.isAbsolute(name)) throw new Error(`name option must not contain an absolute path, found "${name}".`);
        // must not fail on valid .<name> or ..<name> or similar such constructs
        const basename = path.basename(name);
        if (basename === '..' || basename === '.' || basename !== name) {
            throw new Error(`name option must not contain a path, found "${name}".`);
        }
    }
    /* istanbul ignore else */ if (!_isUndefined(options.template)) {
        if (typeof options.template !== 'string') {
            throw new Error(`template option must be a string, got "${typeof options.template}".`);
        }
        if (!options.template.match(TEMPLATE_PATTERN)) {
            throw new Error(`Invalid template, found "${options.template}".`);
        }
    }
    /* istanbul ignore else */ if (!_isUndefined(options.tries) && isNaN(options.tries) || options.tries < 0) {
        throw new Error(`Invalid tries, found "${options.tries}".`);
    }
    // if a name was specified we will try once
    options.tries = _isUndefined(options.name) ? options.tries || DEFAULT_TRIES : 1;
    options.keep = !!options.keep;
    options.detachDescriptor = !!options.detachDescriptor;
    options.discardDescriptor = !!options.discardDescriptor;
    options.unsafeCleanup = !!options.unsafeCleanup;
    // for completeness' sake only, also keep (multiple) blanks if the user, purportedly sane, requests us to
    options.prefix = _isUndefined(options.prefix) ? '' : _assertPath('prefix', options.prefix);
    options.postfix = _isUndefined(options.postfix) ? '' : _assertPath('postfix', options.postfix);
    options.template = _isUndefined(options.template) ? undefined : _assertPath('template', options.template);
}
/**
 * Gets the relative directory to tmpDir.
 *
 * @private
 */ function _getRelativePath(option, name, tmpDir, cb) {
    if (_isUndefined(name)) return cb(null);
    _resolvePath(name, tmpDir, function(err, resolvedPath) {
        if (err) return cb(err);
        const relativePath = path.relative(tmpDir, resolvedPath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            return cb(new Error(`${option} option must be relative to "${tmpDir}", found "${relativePath}".`));
        }
        cb(null, relativePath);
    });
}
/**
 * Gets the relative path to tmpDir.
 *
 * @private
 */ function _getRelativePathSync(option, name, tmpDir) {
    if (_isUndefined(name)) return;
    const resolvedPath = _resolvePathSync(name, tmpDir);
    const relativePath = path.relative(tmpDir, resolvedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error(`${option} option must be relative to "${tmpDir}", found "${relativePath}".`);
    }
    return relativePath;
}
/**
 * Asserts whether the specified options are valid, also sanitizes options and provides sane defaults for missing
 * options.
 *
 * @private
 */ function _assertAndSanitizeOptions(options, cb) {
    _getTmpDir(options, function(err, tmpDir) {
        if (err) return cb(err);
        options.tmpdir = tmpDir;
        try {
            _assertOptionsBase(options, tmpDir);
        } catch (err) {
            return cb(err);
        }
        // sanitize dir, also keep (multiple) blanks if the user, purportedly sane, requests us to
        _getRelativePath('dir', options.dir, tmpDir, function(err, dir) {
            if (err) return cb(err);
            options.dir = _isUndefined(dir) ? '' : dir;
            // sanitize further if template is relative to options.dir
            _getRelativePath('template', options.template, tmpDir, function(err, template) {
                if (err) return cb(err);
                options.template = template;
                cb(null, options);
            });
        });
    });
}
/**
 * Asserts whether the specified options are valid, also sanitizes options and provides sane defaults for missing
 * options.
 *
 * @private
 */ function _assertAndSanitizeOptionsSync(options) {
    const tmpDir = options.tmpdir = _getTmpDirSync(options);
    _assertOptionsBase(options, tmpDir);
    const dir = _getRelativePathSync('dir', options.dir, tmpDir);
    options.dir = _isUndefined(dir) ? '' : dir;
    options.template = _getRelativePathSync('template', options.template, tmpDir);
    return options;
}
/**
 * Helper for testing against EBADF to compensate changes made to Node 7.x under Windows.
 *
 * @private
 */ function _isEBADF(error) {
    return _isExpectedError(error, -EBADF, 'EBADF');
}
/**
 * Helper for testing against ENOENT to compensate changes made to Node 7.x under Windows.
 *
 * @private
 */ function _isENOENT(error) {
    return _isExpectedError(error, -ENOENT, 'ENOENT');
}
/**
 * Helper to determine whether the expected error code matches the actual code and errno,
 * which will differ between the supported node versions.
 *
 * - Node >= 7.0:
 *   error.code {string}
 *   error.errno {number} any numerical value will be negated
 *
 * CAVEAT
 *
 * On windows, the errno for EBADF is -4083 but os.constants.errno.EBADF is different and we must assume that ENOENT
 * is no different here.
 *
 * @param {SystemError} error
 * @param {number} errno
 * @param {string} code
 * @private
 */ function _isExpectedError(error, errno, code) {
    return ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : error.code === code && error.errno === errno;
}
/**
 * Sets the graceful cleanup.
 *
 * If graceful cleanup is set, tmp will remove all controlled temporary objects on process exit, otherwise the
 * temporary objects will remain in place, waiting to be cleaned up on system restart or otherwise scheduled temporary
 * object removals.
 */ function setGracefulCleanup() {
    _gracefulCleanup = true;
}
/**
 * Returns the currently configured tmp dir from os.tmpdir().
 *
 * @private
 */ function _getTmpDir(options, cb) {
    return fs.realpath(options && options.tmpdir || os.tmpdir(), cb);
}
/**
 * Returns the currently configured tmp dir from os.tmpdir().
 *
 * @private
 */ function _getTmpDirSync(options) {
    return fs.realpathSync(options && options.tmpdir || os.tmpdir());
}
// Install process exit listener
process.addListener(EXIT, _garbageCollector);
/**
 * Configuration options.
 *
 * @typedef {Object} Options
 * @property {?boolean} keep the temporary object (file or dir) will not be garbage collected
 * @property {?number} tries the number of tries before give up the name generation
 * @property (?int) mode the access mode, defaults are 0o700 for directories and 0o600 for files
 * @property {?string} template the "mkstemp" like filename template
 * @property {?string} name fixed name relative to tmpdir or the specified dir option
 * @property {?string} dir tmp directory relative to the root tmp directory in use
 * @property {?string} prefix prefix for the generated name
 * @property {?string} postfix postfix for the generated name
 * @property {?string} tmpdir the root tmp directory which overrides the os tmpdir
 * @property {?boolean} unsafeCleanup recursively removes the created temporary directory, even when it's not empty
 * @property {?boolean} detachDescriptor detaches the file descriptor, caller is responsible for closing the file, tmp will no longer try closing the file during garbage collection
 * @property {?boolean} discardDescriptor discards the file descriptor (closes file, fd is -1), tmp will no longer try closing the file during garbage collection
 */ /**
 * @typedef {Object} FileSyncObject
 * @property {string} name the name of the file
 * @property {string} fd the file descriptor or -1 if the fd has been discarded
 * @property {fileCallback} removeCallback the callback function to remove the file
 */ /**
 * @typedef {Object} DirSyncObject
 * @property {string} name the name of the directory
 * @property {fileCallback} removeCallback the callback function to remove the directory
 */ /**
 * @callback tmpNameCallback
 * @param {?Error} err the error object if anything goes wrong
 * @param {string} name the temporary file name
 */ /**
 * @callback fileCallback
 * @param {?Error} err the error object if anything goes wrong
 * @param {string} name the temporary file name
 * @param {number} fd the file descriptor or -1 if the fd had been discarded
 * @param {cleanupCallback} fn the cleanup callback function
 */ /**
 * @callback fileCallbackSync
 * @param {?Error} err the error object if anything goes wrong
 * @param {string} name the temporary file name
 * @param {number} fd the file descriptor or -1 if the fd had been discarded
 * @param {cleanupCallbackSync} fn the cleanup callback function
 */ /**
 * @callback dirCallback
 * @param {?Error} err the error object if anything goes wrong
 * @param {string} name the temporary file name
 * @param {cleanupCallback} fn the cleanup callback function
 */ /**
 * @callback dirCallbackSync
 * @param {?Error} err the error object if anything goes wrong
 * @param {string} name the temporary file name
 * @param {cleanupCallbackSync} fn the cleanup callback function
 */ /**
 * Removes the temporary created file or directory.
 *
 * @callback cleanupCallback
 * @param {simpleCallback} [next] function to call whenever the tmp object needs to be removed
 */ /**
 * Removes the temporary created file or directory.
 *
 * @callback cleanupCallbackSync
 */ /**
 * Callback function for function composition.
 * @see {@link https://github.com/raszi/node-tmp/issues/57|raszi/node-tmp#57}
 *
 * @callback simpleCallback
 */ // exporting all the needed methods
// evaluate _getTmpDir() lazily, mainly for simplifying testing but it also will
// allow users to reconfigure the temporary directory
Object.defineProperty(module.exports, 'tmpdir', {
    enumerable: true,
    configurable: false,
    get: function() {
        return _getTmpDirSync();
    }
});
module.exports.dir = dir;
module.exports.dirSync = dirSync;
module.exports.file = file;
module.exports.fileSync = fileSync;
module.exports.tmpName = tmpName;
module.exports.tmpNameSync = tmpNameSync;
module.exports.setGracefulCleanup = setGracefulCleanup;
}),
"[project]/node_modules/sprintf-js/src/sprintf.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/* global window, exports, define */ !function() {
    'use strict';
    var re = {
        not_string: /[^s]/,
        not_bool: /[^t]/,
        not_type: /[^T]/,
        not_primitive: /[^v]/,
        number: /[diefg]/,
        numeric_arg: /[bcdiefguxX]/,
        json: /[j]/,
        not_json: /[^j]/,
        text: /^[^\x25]+/,
        modulo: /^\x25{2}/,
        placeholder: /^\x25(?:([1-9]\d*)\$|\(([^)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-gijostTuvxX])/,
        key: /^([a-z_][a-z_\d]*)/i,
        key_access: /^\.([a-z_][a-z_\d]*)/i,
        index_access: /^\[(\d+)\]/,
        sign: /^[+-]/
    };
    function sprintf(key) {
        // `arguments` is not an array, but should be fine for this call
        return sprintf_format(sprintf_parse(key), arguments);
    }
    function vsprintf(fmt, argv) {
        return sprintf.apply(null, [
            fmt
        ].concat(argv || []));
    }
    function sprintf_format(parse_tree, argv) {
        var cursor = 1, tree_length = parse_tree.length, arg, output = '', i, k, ph, pad, pad_character, pad_length, is_positive, sign;
        for(i = 0; i < tree_length; i++){
            if (typeof parse_tree[i] === 'string') {
                output += parse_tree[i];
            } else if (typeof parse_tree[i] === 'object') {
                ph = parse_tree[i]; // convenience purposes only
                if (ph.keys) {
                    arg = argv[cursor];
                    for(k = 0; k < ph.keys.length; k++){
                        if (arg == undefined) {
                            throw new Error(sprintf('[sprintf] Cannot access property "%s" of undefined value "%s"', ph.keys[k], ph.keys[k - 1]));
                        }
                        arg = arg[ph.keys[k]];
                    }
                } else if (ph.param_no) {
                    arg = argv[ph.param_no];
                } else {
                    arg = argv[cursor++];
                }
                if (re.not_type.test(ph.type) && re.not_primitive.test(ph.type) && arg instanceof Function) {
                    arg = arg();
                }
                if (re.numeric_arg.test(ph.type) && typeof arg !== 'number' && isNaN(arg)) {
                    throw new TypeError(sprintf('[sprintf] expecting number but found %T', arg));
                }
                if (re.number.test(ph.type)) {
                    is_positive = arg >= 0;
                }
                switch(ph.type){
                    case 'b':
                        arg = parseInt(arg, 10).toString(2);
                        break;
                    case 'c':
                        arg = String.fromCharCode(parseInt(arg, 10));
                        break;
                    case 'd':
                    case 'i':
                        arg = parseInt(arg, 10);
                        break;
                    case 'j':
                        arg = JSON.stringify(arg, null, ph.width ? parseInt(ph.width) : 0);
                        break;
                    case 'e':
                        arg = ph.precision ? parseFloat(arg).toExponential(ph.precision) : parseFloat(arg).toExponential();
                        break;
                    case 'f':
                        arg = ph.precision ? parseFloat(arg).toFixed(ph.precision) : parseFloat(arg);
                        break;
                    case 'g':
                        arg = ph.precision ? String(Number(arg.toPrecision(ph.precision))) : parseFloat(arg);
                        break;
                    case 'o':
                        arg = (parseInt(arg, 10) >>> 0).toString(8);
                        break;
                    case 's':
                        arg = String(arg);
                        arg = ph.precision ? arg.substring(0, ph.precision) : arg;
                        break;
                    case 't':
                        arg = String(!!arg);
                        arg = ph.precision ? arg.substring(0, ph.precision) : arg;
                        break;
                    case 'T':
                        arg = Object.prototype.toString.call(arg).slice(8, -1).toLowerCase();
                        arg = ph.precision ? arg.substring(0, ph.precision) : arg;
                        break;
                    case 'u':
                        arg = parseInt(arg, 10) >>> 0;
                        break;
                    case 'v':
                        arg = arg.valueOf();
                        arg = ph.precision ? arg.substring(0, ph.precision) : arg;
                        break;
                    case 'x':
                        arg = (parseInt(arg, 10) >>> 0).toString(16);
                        break;
                    case 'X':
                        arg = (parseInt(arg, 10) >>> 0).toString(16).toUpperCase();
                        break;
                }
                if (re.json.test(ph.type)) {
                    output += arg;
                } else {
                    if (re.number.test(ph.type) && (!is_positive || ph.sign)) {
                        sign = is_positive ? '+' : '-';
                        arg = arg.toString().replace(re.sign, '');
                    } else {
                        sign = '';
                    }
                    pad_character = ph.pad_char ? ph.pad_char === '0' ? '0' : ph.pad_char.charAt(1) : ' ';
                    pad_length = ph.width - (sign + arg).length;
                    pad = ph.width ? pad_length > 0 ? pad_character.repeat(pad_length) : '' : '';
                    output += ph.align ? sign + arg + pad : pad_character === '0' ? sign + pad + arg : pad + sign + arg;
                }
            }
        }
        return output;
    }
    var sprintf_cache = Object.create(null);
    function sprintf_parse(fmt) {
        if (sprintf_cache[fmt]) {
            return sprintf_cache[fmt];
        }
        var _fmt = fmt, match, parse_tree = [], arg_names = 0;
        while(_fmt){
            if ((match = re.text.exec(_fmt)) !== null) {
                parse_tree.push(match[0]);
            } else if ((match = re.modulo.exec(_fmt)) !== null) {
                parse_tree.push('%');
            } else if ((match = re.placeholder.exec(_fmt)) !== null) {
                if (match[2]) {
                    arg_names |= 1;
                    var field_list = [], replacement_field = match[2], field_match = [];
                    if ((field_match = re.key.exec(replacement_field)) !== null) {
                        field_list.push(field_match[1]);
                        while((replacement_field = replacement_field.substring(field_match[0].length)) !== ''){
                            if ((field_match = re.key_access.exec(replacement_field)) !== null) {
                                field_list.push(field_match[1]);
                            } else if ((field_match = re.index_access.exec(replacement_field)) !== null) {
                                field_list.push(field_match[1]);
                            } else {
                                throw new SyntaxError('[sprintf] failed to parse named argument key');
                            }
                        }
                    } else {
                        throw new SyntaxError('[sprintf] failed to parse named argument key');
                    }
                    match[2] = field_list;
                } else {
                    arg_names |= 2;
                }
                if (arg_names === 3) {
                    throw new Error('[sprintf] mixing positional and named placeholders is not (yet) supported');
                }
                parse_tree.push({
                    placeholder: match[0],
                    param_no: match[1],
                    keys: match[2],
                    sign: match[3],
                    pad_char: match[4],
                    align: match[5],
                    width: match[6],
                    precision: match[7],
                    type: match[8]
                });
            } else {
                throw new SyntaxError('[sprintf] unexpected placeholder');
            }
            _fmt = _fmt.substring(match[0].length);
        }
        return sprintf_cache[fmt] = parse_tree;
    }
    /**
     * export to either browser or node.js
     */ /* eslint-disable quote-props */ if ("TURBOPACK compile-time truthy", 1) {
        exports['sprintf'] = sprintf;
        exports['vsprintf'] = vsprintf;
    }
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
/* eslint-enable quote-props */ }(); // eslint-disable-line
}),
"[project]/node_modules/readline-sync/lib/readline-sync.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/*
 * readlineSync
 * https://github.com/anseki/readline-sync
 *
 * Copyright (c) 2019 anseki
 * Licensed under the MIT license.
 */ var IS_WIN = process.platform === 'win32', ALGORITHM_CIPHER = 'aes-256-cbc', ALGORITHM_HASH = 'sha256', DEFAULT_ERR_MSG = 'The current environment doesn\'t support interactive reading from TTY.', fs = __turbopack_context__.r("[externals]/fs [external] (fs, cjs)"), TTY = process.binding('tty_wrap').TTY, childProc = __turbopack_context__.r("[externals]/child_process [external] (child_process, cjs)"), pathUtil = __turbopack_context__.r("[externals]/path [external] (path, cjs)"), defaultOptions = {
    /* eslint-disable key-spacing */ prompt: '> ',
    hideEchoBack: false,
    mask: '*',
    limit: [],
    limitMessage: 'Input another, please.$<( [)limit(])>',
    defaultInput: '',
    trueValue: [],
    falseValue: [],
    caseSensitive: false,
    keepWhitespace: false,
    encoding: 'utf8',
    bufferSize: 1024,
    print: void 0,
    history: true,
    cd: false,
    phContent: void 0,
    preCheck: void 0
}, fdR = 'none', isRawMode = false, salt = 0, lastInput = '', inputHistory = [], _DBG_useExt = false, _DBG_checkOptions = false, _DBG_checkMethod = false, fdW, ttyR, extHostPath, extHostArgs, tempdir, rawInput;
function getHostArgs(options) {
    // Send any text to crazy Windows shell safely.
    function encodeArg(arg) {
        return arg.replace(/[^\w\u0080-\uFFFF]/g, function(chr) {
            return '#' + chr.charCodeAt(0) + ';';
        });
    }
    return extHostArgs.concat(function(conf) {
        var args = [];
        Object.keys(conf).forEach(function(optionName) {
            if (conf[optionName] === 'boolean') {
                if (options[optionName]) {
                    args.push('--' + optionName);
                }
            } else if (conf[optionName] === 'string') {
                if (options[optionName]) {
                    args.push('--' + optionName, encodeArg(options[optionName]));
                }
            }
        });
        return args;
    }({
        /* eslint-disable key-spacing */ display: 'string',
        displayOnly: 'boolean',
        keyIn: 'boolean',
        hideEchoBack: 'boolean',
        mask: 'string',
        limit: 'string',
        caseSensitive: 'boolean'
    }));
}
// piping via files (for Node.js v0.10-)
function _execFileSync(options, execOptions) {
    function getTempfile(name) {
        var suffix = '', filepath, fd;
        tempdir = tempdir || __turbopack_context__.r("[externals]/os [external] (os, cjs)").tmpdir();
        while(true){
            filepath = pathUtil.join(tempdir, name + suffix);
            try {
                fd = fs.openSync(filepath, 'wx');
            } catch (e) {
                if (e.code === 'EEXIST') {
                    suffix++;
                    continue;
                } else {
                    throw e;
                }
            }
            fs.closeSync(fd);
            break;
        }
        return filepath;
    }
    var res = {}, pathStdout = getTempfile('readline-sync.stdout'), pathStderr = getTempfile('readline-sync.stderr'), pathExit = getTempfile('readline-sync.exit'), pathDone = getTempfile('readline-sync.done'), crypto = __turbopack_context__.r("[externals]/crypto [external] (crypto, cjs)"), hostArgs, shellPath, shellArgs, exitCode, extMessage, shasum, decipher, password;
    shasum = crypto.createHash(ALGORITHM_HASH);
    shasum.update('' + process.pid + salt++ + Math.random());
    password = shasum.digest('hex');
    decipher = crypto.createDecipher(ALGORITHM_CIPHER, password);
    hostArgs = getHostArgs(options);
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    else {
        shellPath = '/bin/sh';
        shellArgs = [
            '-c',
            // Use `()`, not `{}` for `-c` (text param)
            '("' + extHostPath + '"' + /* ESLint bug? */ // eslint-disable-line no-path-concat
            hostArgs.map(function(arg) {
                return " '" + arg.replace(/'/g, "'\\''") + "'";
            }).join('') + '; echo $?>"' + pathExit + '") 2>"' + pathStderr + '"' + ' |"' + process.execPath + '" "' + ("TURBOPACK compile-time value", "/ROOT/node_modules/readline-sync/lib") + '/encrypt.js"' + ' "' + ALGORITHM_CIPHER + '" "' + password + '"' + ' >"' + pathStdout + '"' + '; echo 1 >"' + pathDone + '"'
        ];
    }
    if (_DBG_checkMethod) {
        _DBG_checkMethod('_execFileSync', hostArgs);
    }
    try {
        childProc.spawn(shellPath, shellArgs, execOptions);
    } catch (e) {
        res.error = new Error(e.message);
        res.error.method = '_execFileSync - spawn';
        res.error.program = shellPath;
        res.error.args = shellArgs;
    }
    while(fs.readFileSync(pathDone, {
        encoding: options.encoding
    }).trim() !== '1'){} // eslint-disable-line no-empty
    if ((exitCode = fs.readFileSync(pathExit, {
        encoding: options.encoding
    }).trim()) === '0') {
        res.input = decipher.update(fs.readFileSync(pathStdout, {
            encoding: 'binary'
        }), 'hex', options.encoding) + decipher.final(options.encoding);
    } else {
        extMessage = fs.readFileSync(pathStderr, {
            encoding: options.encoding
        }).trim();
        res.error = new Error(DEFAULT_ERR_MSG + (extMessage ? '\n' + extMessage : ''));
        res.error.method = '_execFileSync';
        res.error.program = shellPath;
        res.error.args = shellArgs;
        res.error.extMessage = extMessage;
        res.error.exitCode = +exitCode;
    }
    fs.unlinkSync(pathStdout);
    fs.unlinkSync(pathStderr);
    fs.unlinkSync(pathExit);
    fs.unlinkSync(pathDone);
    return res;
}
function readlineExt(options) {
    var res = {}, execOptions = {
        env: process.env,
        encoding: options.encoding
    }, hostArgs, extMessage;
    if (!extHostPath) {
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        else {
            extHostPath = '/bin/sh';
            extHostArgs = [
                ("TURBOPACK compile-time value", "/ROOT/node_modules/readline-sync/lib") + '/read.sh'
            ]; // eslint-disable-line no-path-concat
        }
    }
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    if ("TURBOPACK compile-time truthy", 1) {
        hostArgs = getHostArgs(options);
        if (_DBG_checkMethod) {
            _DBG_checkMethod('execFileSync', hostArgs);
        }
        try {
            res.input = childProc.execFileSync(extHostPath, hostArgs, execOptions);
        } catch (e) {
            extMessage = e.stderr ? (e.stderr + '').trim() : '';
            res.error = new Error(DEFAULT_ERR_MSG + (extMessage ? '\n' + extMessage : ''));
            res.error.method = 'execFileSync';
            res.error.program = extHostPath;
            res.error.args = hostArgs;
            res.error.extMessage = extMessage;
            res.error.exitCode = e.status;
            res.error.code = e.code;
            res.error.signal = e.signal;
        }
    } else //TURBOPACK unreachable
    ;
    if (!res.error) {
        res.input = res.input.replace(/^\s*'|'\s*$/g, '');
        options.display = '';
    }
    return res;
}
/*
  display:            string
  displayOnly:        boolean
  keyIn:              boolean
  hideEchoBack:       boolean
  mask:               string
  limit:              string (pattern)
  caseSensitive:      boolean
  keepWhitespace:     boolean
  encoding, bufferSize, print
*/ function _readlineSync(options) {
    var input = '', displaySave = options.display, silent = !options.display && options.keyIn && options.hideEchoBack && !options.mask;
    function tryExt() {
        var res = readlineExt(options);
        if (res.error) {
            throw res.error;
        }
        return res.input;
    }
    if (_DBG_checkOptions) {
        _DBG_checkOptions(options);
    }
    (function() {
        var fsB, constants, verNum;
        function getFsB() {
            if (!fsB) {
                fsB = process.binding('fs'); // For raw device path
                constants = process.binding('constants');
                // for v6.3.0+
                constants = constants && constants.fs && typeof constants.fs.O_RDWR === 'number' ? constants.fs : constants;
            }
            return fsB;
        }
        if (typeof fdR !== 'string') {
            return;
        }
        fdR = null;
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        else {
            if (process.stdin.isTTY) {
                process.stdin.pause();
                try {
                    fdR = fs.openSync('/dev/tty', 'r'); // device file, not process.stdin
                    ttyR = process.stdin._handle;
                } catch (e) {}
            } else {
                // Node.js v0.12 read() fails.
                try {
                    fdR = fs.openSync('/dev/tty', 'r');
                    ttyR = new TTY(fdR, false);
                } catch (e) {}
            }
            if (process.stdout.isTTY) {
                fdW = process.stdout.fd;
            } else {
                try {
                    fdW = fs.openSync('/dev/tty', 'w');
                } catch (e) {}
            }
        }
    })();
    (function() {
        var isCooked = !options.hideEchoBack && !options.keyIn, atEol, limit, buffer, reqSize, readSize, chunk, line;
        rawInput = '';
        // Node.js v0.10- returns an error if same mode is set.
        function setRawMode(mode) {
            if (mode === isRawMode) {
                return true;
            }
            if (ttyR.setRawMode(mode) !== 0) {
                return false;
            }
            isRawMode = mode;
            return true;
        }
        if (_DBG_useExt || !ttyR || typeof fdW !== 'number' && (options.display || !isCooked)) {
            input = tryExt();
            return;
        }
        if (options.display) {
            fs.writeSync(fdW, options.display);
            options.display = '';
        }
        if (options.displayOnly) {
            return;
        }
        if (!setRawMode(!isCooked)) {
            input = tryExt();
            return;
        }
        reqSize = options.keyIn ? 1 : options.bufferSize;
        // Check `allocUnsafe` to make sure of the new API.
        buffer = Buffer.allocUnsafe && Buffer.alloc ? Buffer.alloc(reqSize) : new Buffer(reqSize);
        if (options.keyIn && options.limit) {
            limit = new RegExp('[^' + options.limit + ']', 'g' + (options.caseSensitive ? '' : 'i'));
        }
        while(true){
            readSize = 0;
            try {
                readSize = fs.readSync(fdR, buffer, 0, reqSize);
            } catch (e) {
                if (e.code !== 'EOF') {
                    setRawMode(false);
                    input += tryExt();
                    return;
                }
            }
            if (readSize > 0) {
                chunk = buffer.toString(options.encoding, 0, readSize);
                rawInput += chunk;
            } else {
                chunk = '\n';
                rawInput += String.fromCharCode(0);
            }
            if (chunk && typeof (line = (chunk.match(/^(.*?)[\r\n]/) || [])[1]) === 'string') {
                chunk = line;
                atEol = true;
            }
            // other ctrl-chars
            // eslint-disable-next-line no-control-regex
            if (chunk) {
                chunk = chunk.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
            }
            if (chunk && limit) {
                chunk = chunk.replace(limit, '');
            }
            if (chunk) {
                if (!isCooked) {
                    if (!options.hideEchoBack) {
                        fs.writeSync(fdW, chunk);
                    } else if (options.mask) {
                        fs.writeSync(fdW, new Array(chunk.length + 1).join(options.mask));
                    }
                }
                input += chunk;
            }
            if (!options.keyIn && atEol || options.keyIn && input.length >= reqSize) {
                break;
            }
        }
        if (!isCooked && !silent) {
            fs.writeSync(fdW, '\n');
        }
        setRawMode(false);
    })();
    if (options.print && !silent) {
        options.print(displaySave + (options.displayOnly ? '' : (options.hideEchoBack ? new Array(input.length + 1).join(options.mask) : input) + '\n' // must at least write '\n'
        ), options.encoding);
    }
    return options.displayOnly ? '' : lastInput = options.keepWhitespace || options.keyIn ? input : input.trim();
}
function flattenArray(array, validator) {
    var flatArray = [];
    function _flattenArray(array) {
        if (array == null) {
            return;
        }
        if (Array.isArray(array)) {
            array.forEach(_flattenArray);
        } else if (!validator || validator(array)) {
            flatArray.push(array);
        }
    }
    _flattenArray(array);
    return flatArray;
}
function escapePattern(pattern) {
    return pattern.replace(/[\x00-\x7f]/g, function(s) {
        return '\\x' + ('00' + s.charCodeAt().toString(16)).substr(-2);
    });
}
// margeOptions(options1, options2 ... )
// margeOptions(true, options1, options2 ... )
//    arg1=true : Start from defaultOptions and pick elements of that.
function margeOptions() {
    var optionsList = Array.prototype.slice.call(arguments), optionNames, fromDefault;
    if (optionsList.length && typeof optionsList[0] === 'boolean') {
        fromDefault = optionsList.shift();
        if (fromDefault) {
            optionNames = Object.keys(defaultOptions);
            optionsList.unshift(defaultOptions);
        }
    }
    return optionsList.reduce(function(options, optionsPart) {
        if (optionsPart == null) {
            return options;
        }
        // ======== DEPRECATED ========
        if (optionsPart.hasOwnProperty('noEchoBack') && !optionsPart.hasOwnProperty('hideEchoBack')) {
            optionsPart.hideEchoBack = optionsPart.noEchoBack;
            delete optionsPart.noEchoBack;
        }
        if (optionsPart.hasOwnProperty('noTrim') && !optionsPart.hasOwnProperty('keepWhitespace')) {
            optionsPart.keepWhitespace = optionsPart.noTrim;
            delete optionsPart.noTrim;
        }
        // ======== /DEPRECATED ========
        if (!fromDefault) {
            optionNames = Object.keys(optionsPart);
        }
        optionNames.forEach(function(optionName) {
            var value;
            if (!optionsPart.hasOwnProperty(optionName)) {
                return;
            }
            value = optionsPart[optionName];
            /* eslint-disable no-multi-spaces */ switch(optionName){
                //                    _readlineSync <- *    * -> defaultOptions
                // ================ string
                case 'mask':
                case 'limitMessage':
                case 'defaultInput':
                case 'encoding':
                    value = value != null ? value + '' : '';
                    if (value && optionName !== 'limitMessage') {
                        value = value.replace(/[\r\n]/g, '');
                    }
                    options[optionName] = value;
                    break;
                // ================ number(int)
                case 'bufferSize':
                    if (!isNaN(value = parseInt(value, 10)) && typeof value === 'number') {
                        options[optionName] = value; // limited updating (number is needed)
                    }
                    break;
                // ================ boolean
                case 'displayOnly':
                case 'keyIn':
                case 'hideEchoBack':
                case 'caseSensitive':
                case 'keepWhitespace':
                case 'history':
                case 'cd':
                    options[optionName] = !!value;
                    break;
                // ================ array
                case 'limit':
                case 'trueValue':
                case 'falseValue':
                    options[optionName] = flattenArray(value, function(value) {
                        var type = typeof value;
                        return type === 'string' || type === 'number' || type === 'function' || value instanceof RegExp;
                    }).map(function(value) {
                        return typeof value === 'string' ? value.replace(/[\r\n]/g, '') : value;
                    });
                    break;
                // ================ function
                case 'print':
                case 'phContent':
                case 'preCheck':
                    options[optionName] = typeof value === 'function' ? value : void 0;
                    break;
                // ================ other
                case 'prompt':
                case 'display':
                    options[optionName] = value != null ? value : '';
                    break;
            }
        /* eslint-enable no-multi-spaces */ });
        return options;
    }, {});
}
function isMatched(res, comps, caseSensitive) {
    return comps.some(function(comp) {
        var type = typeof comp;
        return type === 'string' ? caseSensitive ? res === comp : res.toLowerCase() === comp.toLowerCase() : type === 'number' ? parseFloat(res) === comp : type === 'function' ? comp(res) : comp instanceof RegExp ? comp.test(res) : false;
    });
}
function replaceHomePath(path, expand) {
    var homePath = pathUtil.normalize(("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : process.env.HOME || '').replace(/[/\\]+$/, '');
    path = pathUtil.normalize(path);
    return expand ? path.replace(/^~(?=\/|\\|$)/, homePath) : path.replace(new RegExp('^' + escapePattern(homePath) + '(?=\\/|\\\\|$)', ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : ''), '~');
}
function replacePlaceholder(text, generator) {
    var PTN_INNER = '(?:\\(([\\s\\S]*?)\\))?(\\w+|.-.)(?:\\(([\\s\\S]*?)\\))?', rePlaceholder = new RegExp('(\\$)?(\\$<' + PTN_INNER + '>)', 'g'), rePlaceholderCompat = new RegExp('(\\$)?(\\$\\{' + PTN_INNER + '\\})', 'g');
    function getPlaceholderText(s, escape, placeholder, pre, param, post) {
        var text;
        return escape || typeof (text = generator(param)) !== 'string' ? placeholder : text ? (pre || '') + text + (post || '') : '';
    }
    return text.replace(rePlaceholder, getPlaceholderText).replace(rePlaceholderCompat, getPlaceholderText);
}
function array2charlist(array, caseSensitive, collectSymbols) {
    var group = [], groupClass = -1, charCode = 0, symbols = '', values, suppressed;
    function addGroup(groups, group) {
        if (group.length > 3) {
            groups.push(group[0] + '...' + group[group.length - 1]);
            suppressed = true;
        } else if (group.length) {
            groups = groups.concat(group);
        }
        return groups;
    }
    values = array.reduce(function(chars, value) {
        return chars.concat((value + '').split(''));
    }, []).reduce(function(groups, curChar) {
        var curGroupClass, curCharCode;
        if (!caseSensitive) {
            curChar = curChar.toLowerCase();
        }
        curGroupClass = /^\d$/.test(curChar) ? 1 : /^[A-Z]$/.test(curChar) ? 2 : /^[a-z]$/.test(curChar) ? 3 : 0;
        if (collectSymbols && curGroupClass === 0) {
            symbols += curChar;
        } else {
            curCharCode = curChar.charCodeAt(0);
            if (curGroupClass && curGroupClass === groupClass && curCharCode === charCode + 1) {
                group.push(curChar);
            } else {
                groups = addGroup(groups, group);
                group = [
                    curChar
                ];
                groupClass = curGroupClass;
            }
            charCode = curCharCode;
        }
        return groups;
    }, []);
    values = addGroup(values, group); // last group
    if (symbols) {
        values.push(symbols);
        suppressed = true;
    }
    return {
        values: values,
        suppressed: suppressed
    };
}
function joinChunks(chunks, suppressed) {
    return chunks.join(chunks.length > 2 ? ', ' : suppressed ? ' / ' : '/');
}
function getPhContent(param, options) {
    var resCharlist = {}, text, values, arg;
    if (options.phContent) {
        text = options.phContent(param, options);
    }
    if (typeof text !== 'string') {
        switch(param){
            case 'hideEchoBack':
            case 'mask':
            case 'defaultInput':
            case 'caseSensitive':
            case 'keepWhitespace':
            case 'encoding':
            case 'bufferSize':
            case 'history':
            case 'cd':
                text = !options.hasOwnProperty(param) ? '' : typeof options[param] === 'boolean' ? options[param] ? 'on' : 'off' : options[param] + '';
                break;
            // case 'prompt':
            // case 'query':
            // case 'display':
            //   text = options.hasOwnProperty('displaySrc') ? options.displaySrc + '' : '';
            //   break;
            case 'limit':
            case 'trueValue':
            case 'falseValue':
                values = options[options.hasOwnProperty(param + 'Src') ? param + 'Src' : param];
                if (options.keyIn) {
                    resCharlist = array2charlist(values, options.caseSensitive);
                    values = resCharlist.values;
                } else {
                    values = values.filter(function(value) {
                        var type = typeof value;
                        return type === 'string' || type === 'number';
                    });
                }
                text = joinChunks(values, resCharlist.suppressed);
                break;
            case 'limitCount':
            case 'limitCountNotZero':
                text = options[options.hasOwnProperty('limitSrc') ? 'limitSrc' : 'limit'].length;
                text = text || param !== 'limitCountNotZero' ? text + '' : '';
                break;
            case 'lastInput':
                text = lastInput;
                break;
            case 'cwd':
            case 'CWD':
            case 'cwdHome':
                text = process.cwd();
                if (param === 'CWD') {
                    text = pathUtil.basename(text);
                } else if (param === 'cwdHome') {
                    text = replaceHomePath(text);
                }
                break;
            case 'date':
            case 'time':
            case 'localeDate':
            case 'localeTime':
                text = new Date()['to' + param.replace(/^./, function(str) {
                    return str.toUpperCase();
                }) + 'String']();
                break;
            default:
                if (typeof (arg = (param.match(/^history_m(\d+)$/) || [])[1]) === 'string') {
                    text = inputHistory[inputHistory.length - arg] || '';
                }
        }
    }
    return text;
}
function getPhCharlist(param) {
    var matches = /^(.)-(.)$/.exec(param), text = '', from, to, code, step;
    if (!matches) {
        return null;
    }
    from = matches[1].charCodeAt(0);
    to = matches[2].charCodeAt(0);
    step = from < to ? 1 : -1;
    for(code = from; code !== to + step; code += step){
        text += String.fromCharCode(code);
    }
    return text;
}
// cmd "arg" " a r g " "" 'a"r"g' "a""rg" "arg
function parseCl(cl) {
    var reToken = new RegExp(/(\s*)(?:("|')(.*?)(?:\2|$)|(\S+))/g), taken = '', args = [], matches, part;
    cl = cl.trim();
    while(matches = reToken.exec(cl)){
        part = matches[3] || matches[4] || '';
        if (matches[1]) {
            args.push(taken);
            taken = '';
        }
        taken += part;
    }
    if (taken) {
        args.push(taken);
    }
    return args;
}
function toBool(res, options) {
    return options.trueValue.length && isMatched(res, options.trueValue, options.caseSensitive) ? true : options.falseValue.length && isMatched(res, options.falseValue, options.caseSensitive) ? false : res;
}
function getValidLine(options) {
    var res, forceNext, limitMessage, matches, histInput, args, resCheck;
    function _getPhContent(param) {
        return getPhContent(param, options);
    }
    function addDisplay(text) {
        options.display += (/[^\r\n]$/.test(options.display) ? '\n' : '') + text;
    }
    options.limitSrc = options.limit;
    options.displaySrc = options.display;
    options.limit = ''; // for readlineExt
    options.display = replacePlaceholder(options.display + '', _getPhContent);
    while(true){
        res = _readlineSync(options);
        forceNext = false;
        limitMessage = '';
        if (options.defaultInput && !res) {
            res = options.defaultInput;
        }
        if (options.history) {
            if (matches = /^\s*!(?:!|-1)(:p)?\s*$/.exec(res)) {
                histInput = inputHistory[0] || '';
                if (matches[1]) {
                    forceNext = true;
                } else {
                    res = histInput;
                }
                // Show it even if it is empty (NL only).
                addDisplay(histInput + '\n');
                if (!forceNext) {
                    options.displayOnly = true;
                    _readlineSync(options);
                    options.displayOnly = false;
                }
            } else if (res && res !== inputHistory[inputHistory.length - 1]) {
                inputHistory = [
                    res
                ];
            }
        }
        if (!forceNext && options.cd && res) {
            args = parseCl(res);
            switch(args[0].toLowerCase()){
                case 'cd':
                    if (args[1]) {
                        try {
                            process.chdir(replaceHomePath(args[1], true));
                        } catch (e) {
                            addDisplay(e + '');
                        }
                    }
                    forceNext = true;
                    break;
                case 'pwd':
                    addDisplay(process.cwd());
                    forceNext = true;
                    break;
            }
        }
        if (!forceNext && options.preCheck) {
            resCheck = options.preCheck(res, options);
            res = resCheck.res;
            if (resCheck.forceNext) {
                forceNext = true;
            } // Don't switch to false.
        }
        if (!forceNext) {
            if (!options.limitSrc.length || isMatched(res, options.limitSrc, options.caseSensitive)) {
                break;
            }
            if (options.limitMessage) {
                limitMessage = replacePlaceholder(options.limitMessage, _getPhContent);
            }
        }
        addDisplay((limitMessage ? limitMessage + '\n' : '') + replacePlaceholder(options.displaySrc + '', _getPhContent));
    }
    return toBool(res, options);
}
// for dev
exports._DBG_set_useExt = function(val) {
    _DBG_useExt = val;
};
exports._DBG_set_checkOptions = function(val) {
    _DBG_checkOptions = val;
};
exports._DBG_set_checkMethod = function(val) {
    _DBG_checkMethod = val;
};
exports._DBG_clearHistory = function() {
    lastInput = '';
    inputHistory = [];
};
// ------------------------------------
exports.setDefaultOptions = function(options) {
    defaultOptions = margeOptions(true, options);
    return margeOptions(true); // copy
};
exports.question = function(query, options) {
    /* eslint-disable key-spacing */ return getValidLine(margeOptions(margeOptions(true, options), {
        display: query
    }));
/* eslint-enable key-spacing */ };
exports.prompt = function(options) {
    var readOptions = margeOptions(true, options);
    readOptions.display = readOptions.prompt;
    return getValidLine(readOptions);
};
exports.keyIn = function(query, options) {
    /* eslint-disable key-spacing */ var readOptions = margeOptions(margeOptions(true, options), {
        display: query,
        keyIn: true,
        keepWhitespace: true
    });
    /* eslint-enable key-spacing */ // char list
    readOptions.limitSrc = readOptions.limit.filter(function(value) {
        var type = typeof value;
        return type === 'string' || type === 'number';
    }).map(function(text) {
        return replacePlaceholder(text + '', getPhCharlist);
    });
    // pattern
    readOptions.limit = escapePattern(readOptions.limitSrc.join(''));
    [
        'trueValue',
        'falseValue'
    ].forEach(function(optionName) {
        readOptions[optionName] = readOptions[optionName].reduce(function(comps, comp) {
            var type = typeof comp;
            if (type === 'string' || type === 'number') {
                comps = comps.concat((comp + '').split(''));
            } else {
                comps.push(comp);
            }
            return comps;
        }, []);
    });
    readOptions.display = replacePlaceholder(readOptions.display + '', function(param) {
        return getPhContent(param, readOptions);
    });
    return toBool(_readlineSync(readOptions), readOptions);
};
// ------------------------------------
exports.questionEMail = function(query, options) {
    if (query == null) {
        query = 'Input e-mail address: ';
    }
    /* eslint-disable key-spacing */ return exports.question(query, margeOptions({
        // -------- default
        hideEchoBack: false,
        // http://www.w3.org/TR/html5/forms.html#valid-e-mail-address
        limit: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
        limitMessage: 'Input valid e-mail address, please.',
        trueValue: null,
        falseValue: null
    }, options, {
        // -------- forced
        keepWhitespace: false,
        cd: false
    }));
/* eslint-enable key-spacing */ };
exports.questionNewPassword = function(query, options) {
    /* eslint-disable key-spacing */ var resCharlist, min, max, readOptions = margeOptions({
        // -------- default
        hideEchoBack: true,
        mask: '*',
        limitMessage: 'It can include: $<charlist>\n' + 'And the length must be: $<length>',
        trueValue: null,
        falseValue: null,
        caseSensitive: true
    }, options, {
        // -------- forced
        history: false,
        cd: false,
        // limit (by charlist etc.),
        phContent: function(param) {
            return param === 'charlist' ? resCharlist.text : param === 'length' ? min + '...' + max : null;
        }
    }), // added:     charlist, min, max, confirmMessage, unmatchMessage
    charlist, confirmMessage, unmatchMessage, limit, limitMessage, res1, res2;
    /* eslint-enable key-spacing */ options = options || {};
    charlist = replacePlaceholder(options.charlist ? options.charlist + '' : '$<!-~>', getPhCharlist);
    if (isNaN(min = parseInt(options.min, 10)) || typeof min !== 'number') {
        min = 12;
    }
    if (isNaN(max = parseInt(options.max, 10)) || typeof max !== 'number') {
        max = 24;
    }
    limit = new RegExp('^[' + escapePattern(charlist) + ']{' + min + ',' + max + '}$');
    resCharlist = array2charlist([
        charlist
    ], readOptions.caseSensitive, true);
    resCharlist.text = joinChunks(resCharlist.values, resCharlist.suppressed);
    confirmMessage = options.confirmMessage != null ? options.confirmMessage : 'Reinput a same one to confirm it: ';
    unmatchMessage = options.unmatchMessage != null ? options.unmatchMessage : 'It differs from first one.' + ' Hit only the Enter key if you want to retry from first one.';
    if (query == null) {
        query = 'Input new password: ';
    }
    limitMessage = readOptions.limitMessage;
    while(!res2){
        readOptions.limit = limit;
        readOptions.limitMessage = limitMessage;
        res1 = exports.question(query, readOptions);
        readOptions.limit = [
            res1,
            ''
        ];
        readOptions.limitMessage = unmatchMessage;
        res2 = exports.question(confirmMessage, readOptions);
    }
    return res1;
};
function _questionNum(query, options, parser) {
    var validValue;
    function getValidValue(value) {
        validValue = parser(value);
        return !isNaN(validValue) && typeof validValue === 'number';
    }
    /* eslint-disable key-spacing */ exports.question(query, margeOptions({
        // -------- default
        limitMessage: 'Input valid number, please.'
    }, options, {
        // -------- forced
        limit: getValidValue,
        cd: false
    }));
    /* eslint-enable key-spacing */ return validValue;
}
exports.questionInt = function(query, options) {
    return _questionNum(query, options, function(value) {
        return parseInt(value, 10);
    });
};
exports.questionFloat = function(query, options) {
    return _questionNum(query, options, parseFloat);
};
exports.questionPath = function(query, options) {
    /* eslint-disable key-spacing */ var error = '', validPath, readOptions = margeOptions({
        // -------- default
        hideEchoBack: false,
        limitMessage: '$<error(\n)>Input valid path, please.' + '$<( Min:)min>$<( Max:)max>',
        history: true,
        cd: true
    }, options, {
        // -------- forced
        keepWhitespace: false,
        limit: function(value) {
            var exists, stat, res;
            value = replaceHomePath(value, true);
            error = ''; // for validate
            // mkdir -p
            function mkdirParents(dirPath) {
                dirPath.split(/\/|\\/).reduce(function(parents, dir) {
                    var path = pathUtil.resolve(parents += dir + pathUtil.sep);
                    if (!fs.existsSync(path)) {
                        fs.mkdirSync(path);
                    } else if (!fs.statSync(path).isDirectory()) {
                        throw new Error('Non directory already exists: ' + path);
                    }
                    return parents;
                }, '');
            }
            try {
                exists = fs.existsSync(value);
                validPath = exists ? fs.realpathSync(value) : pathUtil.resolve(value);
                // options.exists default: true, not-bool: no-check
                if (!options.hasOwnProperty('exists') && !exists || typeof options.exists === 'boolean' && options.exists !== exists) {
                    error = (exists ? 'Already exists' : 'No such file or directory') + ': ' + validPath;
                    return false;
                }
                if (!exists && options.create) {
                    if (options.isDirectory) {
                        mkdirParents(validPath);
                    } else {
                        mkdirParents(pathUtil.dirname(validPath));
                        fs.closeSync(fs.openSync(validPath, 'w')); // touch
                    }
                    validPath = fs.realpathSync(validPath);
                }
                if (exists && (options.min || options.max || options.isFile || options.isDirectory)) {
                    stat = fs.statSync(validPath);
                    // type check first (directory has zero size)
                    if (options.isFile && !stat.isFile()) {
                        error = 'Not file: ' + validPath;
                        return false;
                    } else if (options.isDirectory && !stat.isDirectory()) {
                        error = 'Not directory: ' + validPath;
                        return false;
                    } else if (options.min && stat.size < +options.min || options.max && stat.size > +options.max) {
                        error = 'Size ' + stat.size + ' is out of range: ' + validPath;
                        return false;
                    }
                }
                if (typeof options.validate === 'function' && (res = options.validate(validPath)) !== true) {
                    if (typeof res === 'string') {
                        error = res;
                    }
                    return false;
                }
            } catch (e) {
                error = e + '';
                return false;
            }
            return true;
        },
        // trueValue, falseValue, caseSensitive don't work.
        phContent: function(param) {
            return param === 'error' ? error : param !== 'min' && param !== 'max' ? null : options.hasOwnProperty(param) ? options[param] + '' : '';
        }
    });
    // added:     exists, create, min, max, isFile, isDirectory, validate
    /* eslint-enable key-spacing */ options = options || {};
    if (query == null) {
        query = 'Input path (you can "cd" and "pwd"): ';
    }
    exports.question(query, readOptions);
    return validPath;
};
// props: preCheck, args, hRes, limit
function getClHandler(commandHandler, options) {
    var clHandler = {}, hIndex = {};
    if (typeof commandHandler === 'object') {
        Object.keys(commandHandler).forEach(function(cmd) {
            if (typeof commandHandler[cmd] === 'function') {
                hIndex[options.caseSensitive ? cmd : cmd.toLowerCase()] = commandHandler[cmd];
            }
        });
        clHandler.preCheck = function(res) {
            var cmdKey;
            clHandler.args = parseCl(res);
            cmdKey = clHandler.args[0] || '';
            if (!options.caseSensitive) {
                cmdKey = cmdKey.toLowerCase();
            }
            clHandler.hRes = cmdKey !== '_' && hIndex.hasOwnProperty(cmdKey) ? hIndex[cmdKey].apply(res, clHandler.args.slice(1)) : hIndex.hasOwnProperty('_') ? hIndex._.apply(res, clHandler.args) : null;
            return {
                res: res,
                forceNext: false
            };
        };
        if (!hIndex.hasOwnProperty('_')) {
            clHandler.limit = function() {
                var cmdKey = clHandler.args[0] || '';
                if (!options.caseSensitive) {
                    cmdKey = cmdKey.toLowerCase();
                }
                return hIndex.hasOwnProperty(cmdKey);
            };
        }
    } else {
        clHandler.preCheck = function(res) {
            clHandler.args = parseCl(res);
            clHandler.hRes = typeof commandHandler === 'function' ? commandHandler.apply(res, clHandler.args) : true; // true for break loop
            return {
                res: res,
                forceNext: false
            };
        };
    }
    return clHandler;
}
exports.promptCL = function(commandHandler, options) {
    /* eslint-disable key-spacing */ var readOptions = margeOptions({
        // -------- default
        hideEchoBack: false,
        limitMessage: 'Requested command is not available.',
        caseSensitive: false,
        history: true
    }, options), //   -------- forced
    //   trueValue, falseValue, keepWhitespace don't work.
    //   preCheck, limit (by clHandler)
    clHandler = getClHandler(commandHandler, readOptions);
    /* eslint-enable key-spacing */ readOptions.limit = clHandler.limit;
    readOptions.preCheck = clHandler.preCheck;
    exports.prompt(readOptions);
    return clHandler.args;
};
exports.promptLoop = function(inputHandler, options) {
    /* eslint-disable key-spacing */ var readOptions = margeOptions({
        // -------- default
        hideEchoBack: false,
        trueValue: null,
        falseValue: null,
        caseSensitive: false,
        history: true
    }, options);
    /* eslint-enable key-spacing */ while(true){
        if (inputHandler(exports.prompt(readOptions))) {
            break;
        }
    }
// return; // nothing is returned
};
exports.promptCLLoop = function(commandHandler, options) {
    /* eslint-disable key-spacing */ var readOptions = margeOptions({
        // -------- default
        hideEchoBack: false,
        limitMessage: 'Requested command is not available.',
        caseSensitive: false,
        history: true
    }, options), //   -------- forced
    //   trueValue, falseValue, keepWhitespace don't work.
    //   preCheck, limit (by clHandler)
    clHandler = getClHandler(commandHandler, readOptions);
    /* eslint-enable key-spacing */ readOptions.limit = clHandler.limit;
    readOptions.preCheck = clHandler.preCheck;
    while(true){
        exports.prompt(readOptions);
        if (clHandler.hRes) {
            break;
        }
    }
// return; // nothing is returned
};
exports.promptSimShell = function(options) {
    /* eslint-disable key-spacing */ return exports.prompt(margeOptions({
        // -------- default
        hideEchoBack: false,
        history: true
    }, options, {
        // -------- forced
        prompt: function() {
            return ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : // 'user@host:cwd$ '
            (process.env.USER || '') + (process.env.HOSTNAME ? '@' + process.env.HOSTNAME.replace(/\..*$/, '') : '') + ':$<cwdHome>$ ';
        }()
    }));
/* eslint-enable key-spacing */ };
function _keyInYN(query, options, limit) {
    var res;
    if (query == null) {
        query = 'Are you sure? ';
    }
    if ((!options || options.guide !== false) && (query += '')) {
        query = query.replace(/\s*:?\s*$/, '') + ' [y/n]: ';
    }
    /* eslint-disable key-spacing */ res = exports.keyIn(query, margeOptions(options, {
        // -------- forced
        hideEchoBack: false,
        limit: limit,
        trueValue: 'y',
        falseValue: 'n',
        caseSensitive: false
    }));
    // added:     guide
    /* eslint-enable key-spacing */ return typeof res === 'boolean' ? res : '';
}
exports.keyInYN = function(query, options) {
    return _keyInYN(query, options);
};
exports.keyInYNStrict = function(query, options) {
    return _keyInYN(query, options, 'yn');
};
exports.keyInPause = function(query, options) {
    if (query == null) {
        query = 'Continue...';
    }
    if ((!options || options.guide !== false) && (query += '')) {
        query = query.replace(/\s+$/, '') + ' (Hit any key)';
    }
    /* eslint-disable key-spacing */ exports.keyIn(query, margeOptions({
        // -------- default
        limit: null
    }, options, {
        // -------- forced
        hideEchoBack: true,
        mask: ''
    }));
// added:     guide
/* eslint-enable key-spacing */ // return; // nothing is returned
};
exports.keyInSelect = function(items, query, options) {
    /* eslint-disable key-spacing */ var readOptions = margeOptions({
        // -------- default
        hideEchoBack: false
    }, options, {
        // -------- forced
        trueValue: null,
        falseValue: null,
        caseSensitive: false,
        // limit (by items),
        phContent: function(param) {
            return param === 'itemsCount' ? items.length + '' : param === 'firstItem' ? (items[0] + '').trim() : param === 'lastItem' ? (items[items.length - 1] + '').trim() : null;
        }
    }), // added:     guide, cancel
    keylist = '', key2i = {}, charCode = 49 /* '1' */ , display = '\n';
    /* eslint-enable key-spacing */ if (!Array.isArray(items) || !items.length || items.length > 35) {
        throw '`items` must be Array (max length: 35).';
    }
    items.forEach(function(item, i) {
        var key = String.fromCharCode(charCode);
        keylist += key;
        key2i[key] = i;
        display += '[' + key + '] ' + (item + '').trim() + '\n';
        charCode = charCode === 57 /* '9' */  ? 97 /* 'a' */  : charCode + 1;
    });
    if (!options || options.cancel !== false) {
        keylist += '0';
        key2i['0'] = -1;
        display += '[0] ' + (options && options.cancel != null && typeof options.cancel !== 'boolean' ? (options.cancel + '').trim() : 'CANCEL') + '\n';
    }
    readOptions.limit = keylist;
    display += '\n';
    if (query == null) {
        query = 'Choose one from list: ';
    }
    if (query += '') {
        if (!options || options.guide !== false) {
            query = query.replace(/\s*:?\s*$/, '') + ' [$<limit>]: ';
        }
        display += query;
    }
    return key2i[exports.keyIn(display, readOptions).toLowerCase()];
};
exports.getRawInput = function() {
    return rawInput;
};
// ======== DEPRECATED ========
function _setOption(optionName, args) {
    var options;
    if (args.length) {
        options = {};
        options[optionName] = args[0];
    }
    return exports.setDefaultOptions(options)[optionName];
}
exports.setPrint = function() {
    return _setOption('print', arguments);
};
exports.setPrompt = function() {
    return _setOption('prompt', arguments);
};
exports.setEncoding = function() {
    return _setOption('encoding', arguments);
};
exports.setMask = function() {
    return _setOption('mask', arguments);
};
exports.setBufferSize = function() {
    return _setOption('bufferSize', arguments);
};
}),
"[project]/node_modules/fengari-interop/src/js.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

const { lua, lauxlib, lualib, to_luastring } = __turbopack_context__.r("[project]/node_modules/fengari/src/fengari.js [app-route] (ecmascript)");
const { LUA_MULTRET, LUA_OK, LUA_REGISTRYINDEX, LUA_RIDX_MAINTHREAD, LUA_TBOOLEAN, LUA_TFUNCTION, LUA_TLIGHTUSERDATA, LUA_TNIL, LUA_TNONE, LUA_TNUMBER, LUA_TSTRING, LUA_TTABLE, LUA_TTHREAD, LUA_TUSERDATA, lua_atnativeerror, lua_call, lua_getfield, lua_gettable, lua_gettop, lua_isnil, lua_isproxy, lua_newuserdata, lua_pcall, lua_pop, lua_pushboolean, lua_pushcfunction, lua_pushinteger, lua_pushlightuserdata, lua_pushliteral, lua_pushnil, lua_pushnumber, lua_pushstring, lua_pushvalue, lua_rawgeti, lua_rawgetp, lua_rawsetp, lua_rotate, lua_setfield, lua_settable, lua_settop, lua_toboolean, lua_tojsstring, lua_tonumber, lua_toproxy, lua_tothread, lua_touserdata, lua_type } = lua;
const { luaL_argerror, luaL_checkany, luaL_checkoption, luaL_checkstack, luaL_checkudata, luaL_error, luaL_getmetafield, luaL_newlib, luaL_newmetatable, luaL_requiref, luaL_setfuncs, luaL_setmetatable, luaL_testudata, luaL_tolstring } = lauxlib;
const { luaopen_base } = lualib;
const FENGARI_INTEROP_VERSION_MAJOR = "0";
const FENGARI_INTEROP_VERSION_MINOR = "1";
const FENGARI_INTEROP_VERSION_NUM = 1;
const FENGARI_INTEROP_VERSION_RELEASE = "4";
const FENGARI_INTEROP_VERSION = FENGARI_INTEROP_VERSION_MAJOR + "." + FENGARI_INTEROP_VERSION_MINOR;
const FENGARI_INTEROP_RELEASE = FENGARI_INTEROP_VERSION + "." + FENGARI_INTEROP_VERSION_RELEASE;
let custom_inspect_symbol;
if (typeof process !== "undefined") {
    try {
        custom_inspect_symbol = __turbopack_context__.r("[externals]/util [external] (util, cjs)").inspect.custom;
    } catch (e) {}
}
const global_env = function(Object1) {
    return typeof globalThis === 'object' ? globalThis : this ? // compat: strict mode is unsupported
    this : (Object1.defineProperty(Object1.prototype, '_', {
        configurable: true,
        get: function() {
            delete Object1.prototype._;
            return this;
        }
    }), _);
}(Object);
let apply, construct, Reflect_deleteProperty;
if (typeof Reflect !== "undefined") {
    apply = Reflect.apply;
    construct = Reflect.construct;
    Reflect_deleteProperty = Reflect.deleteProperty;
} else {
    const fApply = Function.apply;
    const bind = Function.bind;
    apply = function(target, thisArgument, argumentsList) {
        return fApply.call(target, thisArgument, argumentsList);
    };
    construct = function(target, argumentsList /*, newTarget */ ) {
        switch(argumentsList.length){
            case 0:
                return new target();
            case 1:
                return new target(argumentsList[0]);
            case 2:
                return new target(argumentsList[0], argumentsList[1]);
            case 3:
                return new target(argumentsList[0], argumentsList[1], argumentsList[2]);
            case 4:
                return new target(argumentsList[0], argumentsList[1], argumentsList[2], argumentsList[3]);
        }
        let args = [
            null
        ];
        args.push.apply(args, argumentsList);
        return new (bind.apply(target, args))();
    };
    /* need to be in non-strict mode */ Reflect_deleteProperty = Function("t", "k", "delete t[k]");
}
/*
String.concat coerces to string with correct hint for Symbol.toPrimitive
`this` isn't allowed to be null, so bind the empty string
*/ const toString = String.prototype.concat.bind("");
const isobject = function(o) {
    return typeof o === "object" ? o !== null : typeof o === "function";
};
const js_tname = to_luastring("js object");
const js_library_not_loaded = "js library not loaded into lua_State";
const testjs = function(L, idx) {
    let u = luaL_testudata(L, idx, js_tname);
    if (u) return u.data;
    else return void 0;
};
const checkjs = function(L, idx) {
    return luaL_checkudata(L, idx, js_tname).data;
};
const pushjs = function(L, v) {
    let b = lua_newuserdata(L);
    b.data = v;
    luaL_setmetatable(L, js_tname);
};
const getmainthread = function(L) {
    lua_rawgeti(L, LUA_REGISTRYINDEX, LUA_RIDX_MAINTHREAD);
    let mainL = lua_tothread(L, -1);
    lua_pop(L, 1);
    return mainL;
};
/* weak map from states to proxy objects (for each object) in that state */ const states = new WeakMap();
const push = function(L, v) {
    switch(typeof v){
        case "undefined":
            lua_pushnil(L);
            break;
        case "number":
            lua_pushnumber(L, v);
            break;
        case "string":
            lua_pushstring(L, to_luastring(v));
            break;
        case "boolean":
            lua_pushboolean(L, v);
            break;
        case "symbol":
            lua_pushlightuserdata(L, v);
            break;
        case "function":
            if (lua_isproxy(v, L)) {
                v(L);
                break;
            }
        /* fall through */ case "object":
            if (v === null) {
                /* can't use null in a WeakMap; grab from registry */ if (lua_rawgetp(L, LUA_REGISTRYINDEX, null) !== LUA_TUSERDATA) throw Error(js_library_not_loaded);
                break;
            }
        /* fall through */ default:
            {
                /* Try and push same object again */ let objects_seen = states.get(getmainthread(L));
                if (!objects_seen) throw Error(js_library_not_loaded);
                let p = objects_seen.get(v);
                if (p) {
                    p(L);
                } else {
                    pushjs(L, v);
                    p = lua_toproxy(L, -1);
                    objects_seen.set(v, p);
                }
            }
    }
};
const atnativeerror = function(L) {
    let u = lua_touserdata(L, 1);
    push(L, u);
    return 1;
};
const tojs = function(L, idx) {
    switch(lua_type(L, idx)){
        case LUA_TNONE:
        case LUA_TNIL:
            return void 0;
        case LUA_TBOOLEAN:
            return lua_toboolean(L, idx);
        case LUA_TLIGHTUSERDATA:
            return lua_touserdata(L, idx);
        case LUA_TNUMBER:
            return lua_tonumber(L, idx);
        case LUA_TSTRING:
            return lua_tojsstring(L, idx);
        case LUA_TUSERDATA:
            {
                let u = testjs(L, idx);
                if (u !== void 0) return u;
            }
        /* fall through */ case LUA_TTABLE:
        case LUA_TFUNCTION:
        case LUA_TTHREAD:
        /* fall through */ default:
            return wrap(L, lua_toproxy(L, idx));
    }
};
/* Calls function on the stack with `nargs` from the stack.
   On lua error, re-throws as javascript error
   On success, returns single return value */ const jscall = function(L, nargs) {
    let status = lua_pcall(L, nargs, 1, 0);
    let r = tojs(L, -1);
    lua_pop(L, 1);
    switch(status){
        case LUA_OK:
            return r;
        default:
            throw r;
    }
};
const invoke = function(L, p, thisarg, args, n_results) {
    if (!isobject(args)) throw new TypeError("`args` argument must be an object");
    let length = +args.length;
    if (!(length >= 0)) length = 0; /* Keep NaN in mind */ 
    luaL_checkstack(L, 2 + length, null);
    let base = lua_gettop(L);
    p(L);
    push(L, thisarg);
    for(let i = 0; i < length; i++){
        push(L, args[i]);
    }
    switch(lua_pcall(L, 1 + length, n_results, 0)){
        case LUA_OK:
            {
                let nres = lua_gettop(L) - base;
                let res = new Array(nres);
                for(let i = 0; i < nres; i++){
                    res[i] = tojs(L, base + i + 1);
                }
                lua_settop(L, base);
                return res;
            }
        default:
            {
                let r = tojs(L, -1);
                lua_settop(L, base);
                throw r;
            }
    }
};
const gettable = function(L) {
    lua_gettable(L, 1);
    return 1;
};
const get = function(L, p, prop) {
    luaL_checkstack(L, 3, null);
    lua_pushcfunction(L, gettable);
    p(L);
    push(L, prop);
    return jscall(L, 2);
};
const has = function(L, p, prop) {
    luaL_checkstack(L, 3, null);
    lua_pushcfunction(L, gettable);
    p(L);
    push(L, prop);
    let status = lua_pcall(L, 2, 1, 0);
    switch(status){
        case LUA_OK:
            {
                let r = lua_isnil(L, -1);
                lua_pop(L, 1);
                return !r;
            }
        default:
            {
                let r = tojs(L, -1);
                lua_pop(L, 1);
                throw r;
            }
    }
};
const set = function(L, p, prop, value) {
    luaL_checkstack(L, 4, null);
    lua_pushcfunction(L, function(L) {
        lua_settable(L, 1);
        return 0;
    });
    p(L);
    push(L, prop);
    push(L, value);
    switch(lua_pcall(L, 3, 0, 0)){
        case LUA_OK:
            return;
        default:
            {
                let r = tojs(L, -1);
                lua_pop(L, 1);
                throw r;
            }
    }
};
const deleteProperty = function(L, p, prop) {
    luaL_checkstack(L, 4, null);
    lua_pushcfunction(L, function(L) {
        lua_settable(L, 1);
        return 0;
    });
    p(L);
    push(L, prop);
    lua_pushnil(L);
    switch(lua_pcall(L, 3, 0, 0)){
        case LUA_OK:
            return;
        default:
            {
                let r = tojs(L, -1);
                lua_pop(L, 1);
                throw r;
            }
    }
};
const tostring = function(L, p) {
    luaL_checkstack(L, 2, null);
    lua_pushcfunction(L, function(L) {
        luaL_tolstring(L, 1);
        return 1;
    });
    p(L);
    return jscall(L, 1);
};
/* implements lua's "Generic For" protocol */ const iter_next = function() {
    let L = this.L;
    luaL_checkstack(L, 3, null);
    let top = lua_gettop(L);
    this.iter(L);
    this.state(L);
    this.last(L);
    switch(lua_pcall(L, 2, LUA_MULTRET, 0)){
        case LUA_OK:
            {
                this.last = lua_toproxy(L, top + 1);
                let r;
                if (lua_isnil(L, -1)) {
                    r = {
                        done: true,
                        value: void 0
                    };
                } else {
                    let n_results = lua_gettop(L) - top;
                    let result = new Array(n_results);
                    for(let i = 0; i < n_results; i++){
                        result[i] = tojs(L, top + i + 1);
                    }
                    r = {
                        done: false,
                        value: result
                    };
                }
                lua_settop(L, top);
                return r;
            }
        default:
            {
                let e = tojs(L, -1);
                lua_pop(L, 1);
                throw e;
            }
    }
};
/* make iteration use pairs() */ const jsiterator = function(L, p) {
    luaL_checkstack(L, 1, null);
    lua_pushcfunction(L, function(L) {
        luaL_requiref(L, to_luastring("_G"), luaopen_base, 0);
        lua_getfield(L, -1, to_luastring("pairs"));
        p(L);
        lua_call(L, 1, 3);
        return 3;
    });
    switch(lua_pcall(L, 0, 3, 0)){
        case LUA_OK:
            {
                let iter = lua_toproxy(L, -3);
                let state = lua_toproxy(L, -2);
                let last = lua_toproxy(L, -1);
                lua_pop(L, 3);
                return {
                    L: L,
                    iter: iter,
                    state: state,
                    last: last,
                    next: iter_next
                };
            }
        default:
            {
                let r = tojs(L, -1);
                lua_pop(L, 1);
                throw r;
            }
    }
};
const wrap = function(L1, p) {
    const L = getmainthread(L1);
    /* we need `typeof js_proxy` to be "function" so that it's acceptable to native apis */ let js_proxy = function() {
        /* only get one result */ return invoke(L, p, this, arguments, 1)[0];
    };
    js_proxy.apply = function(thisarg, args) {
        /* only get one result */ return invoke(L, p, thisarg, args, 1)[0];
    };
    js_proxy.invoke = function(thisarg, args) {
        return invoke(L, p, thisarg, args, LUA_MULTRET);
    };
    js_proxy.get = function(k) {
        return get(L, p, k);
    };
    js_proxy.has = function(k) {
        return has(L, p, k);
    };
    js_proxy.set = function(k, v) {
        return set(L, p, k, v);
    };
    js_proxy.delete = function(k) {
        return deleteProperty(L, p, k);
    };
    js_proxy.toString = function() {
        return tostring(L, p);
    };
    if (typeof Symbol === "function") {
        js_proxy[Symbol.toStringTag] = "Fengari object";
        js_proxy[Symbol.iterator] = function() {
            return jsiterator(L, p);
        };
        if (Symbol.toPrimitive) {
            js_proxy[Symbol.toPrimitive] = function(hint) {
                if (hint === "string") {
                    return tostring(L, p);
                }
            };
        }
    }
    if (custom_inspect_symbol) {
        js_proxy[custom_inspect_symbol] = js_proxy.toString;
    }
    let objects_seen = states.get(L);
    if (!objects_seen) throw Error(js_library_not_loaded);
    objects_seen.set(js_proxy, p);
    return js_proxy;
};
const jslib = {
    "new": function(L) {
        let u = tojs(L, 1);
        let nargs = lua_gettop(L) - 1;
        let args = new Array(nargs);
        for(let i = 0; i < nargs; i++){
            args[i] = tojs(L, i + 2);
        }
        push(L, construct(u, args));
        return 1;
    },
    "tonumber": function(L) {
        let u = tojs(L, 1);
        lua_pushnumber(L, +u);
        return 1;
    },
    "tostring": function(L) {
        let u = tojs(L, 1);
        lua_pushliteral(L, toString(u));
        return 1;
    },
    "instanceof": function(L) {
        let u1 = tojs(L, 1);
        let u2 = tojs(L, 2);
        lua_pushboolean(L, u1 instanceof u2);
        return 1;
    },
    "typeof": function(L) {
        let u = tojs(L, 1);
        lua_pushliteral(L, typeof u);
        return 1;
    }
};
if (typeof Symbol === "function" && Symbol.iterator) {
    const get_iterator = function(L, idx) {
        let u = checkjs(L, idx);
        let getiter = u[Symbol.iterator];
        if (!getiter) luaL_argerror(L, idx, to_luastring("object not iterable"));
        let iter = apply(getiter, u, []);
        if (!isobject(iter)) luaL_argerror(L, idx, to_luastring("Result of the Symbol.iterator method is not an object"));
        return iter;
    };
    const next = function(L) {
        let iter = tojs(L, 1);
        let r = iter.next();
        if (r.done) {
            return 0;
        } else {
            push(L, r.value);
            return 1;
        }
    };
    jslib["of"] = function(L) {
        let iter = get_iterator(L, 1);
        lua_pushcfunction(L, next);
        push(L, iter);
        return 2;
    };
}
if (typeof Proxy === "function" && typeof Symbol === "function") {
    const L_symbol = Symbol("lua_State");
    const p_symbol = Symbol("fengari-proxy");
    const proxy_handlers = {
        "apply": function(target, thisarg, args) {
            return invoke(target[L_symbol], target[p_symbol], thisarg, args, 1)[0];
        },
        "construct": function(target, argumentsList) {
            let L = target[L_symbol];
            let p = target[p_symbol];
            let arg_length = argumentsList.length;
            luaL_checkstack(L, 2 + arg_length, null);
            p(L);
            let idx = lua_gettop(L);
            if (luaL_getmetafield(L, idx, to_luastring("construct")) === LUA_TNIL) {
                lua_pop(L, 1);
                throw new TypeError("not a constructor");
            }
            lua_rotate(L, idx, 1);
            for(let i = 0; i < arg_length; i++){
                push(L, argumentsList[i]);
            }
            return jscall(L, 1 + arg_length);
        },
        "defineProperty": function(target, prop, desc) {
            let L = target[L_symbol];
            let p = target[p_symbol];
            luaL_checkstack(L, 4, null);
            p(L);
            if (luaL_getmetafield(L, -1, to_luastring("defineProperty")) === LUA_TNIL) {
                lua_pop(L, 1);
                return false;
            }
            lua_rotate(L, -2, 1);
            push(L, prop);
            push(L, desc);
            return jscall(L, 3);
        },
        "deleteProperty": function(target, k) {
            return deleteProperty(target[L_symbol], target[p_symbol], k);
        },
        "get": function(target, k) {
            return get(target[L_symbol], target[p_symbol], k);
        },
        "getOwnPropertyDescriptor": function(target, prop) {
            let L = target[L_symbol];
            let p = target[p_symbol];
            luaL_checkstack(L, 3, null);
            p(L);
            if (luaL_getmetafield(L, -1, to_luastring("getOwnPropertyDescriptor")) === LUA_TNIL) {
                lua_pop(L, 1);
                return;
            }
            lua_rotate(L, -2, 1);
            push(L, prop);
            return jscall(L, 2);
        },
        "getPrototypeOf": function(target) {
            let L = target[L_symbol];
            let p = target[p_symbol];
            luaL_checkstack(L, 2, null);
            p(L);
            if (luaL_getmetafield(L, -1, to_luastring("getPrototypeOf")) === LUA_TNIL) {
                lua_pop(L, 1);
                return null;
            }
            lua_rotate(L, -2, 1);
            return jscall(L, 1);
        },
        "has": function(target, k) {
            return has(target[L_symbol], target[p_symbol], k);
        },
        "ownKeys": function(target) {
            let L = target[L_symbol];
            let p = target[p_symbol];
            luaL_checkstack(L, 2, null);
            p(L);
            if (luaL_getmetafield(L, -1, to_luastring("ownKeys")) === LUA_TNIL) {
                lua_pop(L, 1);
                throw Error("ownKeys unknown for fengari object");
            }
            lua_rotate(L, -2, 1);
            return jscall(L, 1);
        },
        "set": function(target, k, v) {
            set(target[L_symbol], target[p_symbol], k, v);
            return true;
        },
        "setPrototypeOf": function(target, prototype) {
            let L = target[L_symbol];
            let p = target[p_symbol];
            luaL_checkstack(L, 3, null);
            p(L);
            if (luaL_getmetafield(L, -1, to_luastring("setPrototypeOf")) === LUA_TNIL) {
                lua_pop(L, 1);
                return false;
            }
            lua_rotate(L, -2, 1);
            push(L, prototype);
            return jscall(L, 2);
        }
    };
    /*
	Functions created with `function(){}` have a non-configurable .prototype
	field. This causes issues with the .ownKeys and .getOwnPropertyDescriptor
	traps.
	However using `.bind()` returns a function without the .prototype property.

	```js
	Reflect.ownKeys((function(){})) // Array [ "prototype", "length", "name" ]
	Reflect.ownKeys((function(){}).bind()) // Array [ "length", "name" ]
	```
	*/ const raw_function = function() {
        let f = (function() {}).bind();
        delete f.length;
        delete f.name;
        return f;
    };
    /*
	We use Function() here to get prevent transpilers from converting to a
	non-arrow function.
	To avoid setting off strict CSP rules, we only call Function lazily.
	Additionally, we avoid setting the internal name field by never giving the
	new function a name in the block it was defined (and instead delete-ing
	the configurable fields .length and .name in a wrapper function)
	*/ let make_arrow_function = function() {
        make_arrow_function = Function("return ()=>void 0;");
        return make_arrow_function();
    };
    const raw_arrow_function = function() {
        let f = make_arrow_function();
        delete f.length;
        delete f.name;
        return f;
    };
    /*
	Arrow functions do not have a .prototype field:

	```js
	Reflect.ownKeys((() = >void 0)) // Array [ "length", "name" ]
	```

	However they cannot be used as a constructor:

	```js
	new (new Proxy(() => void 0, { construct: function() { return {}; } })) // TypeError: (intermediate value) is not a constructor
	new (new Proxy(function(){}, { construct: function() { return {}; } })) // {}
	```
	*/ const createproxy = function(L1, p, type) {
        const L = getmainthread(L1);
        let target;
        switch(type){
            case "function":
                target = raw_function();
                break;
            case "arrow_function":
                target = raw_arrow_function();
                break;
            case "object":
                target = {};
                break;
            default:
                throw TypeError("invalid type to createproxy");
        }
        target[p_symbol] = p;
        target[L_symbol] = L;
        return new Proxy(target, proxy_handlers);
    };
    const valid_types = [
        "function",
        "arrow_function",
        "object"
    ];
    const valid_types_as_luastring = valid_types.map((v)=>to_luastring(v));
    jslib["createproxy"] = function(L) {
        luaL_checkany(L, 1);
        let type = valid_types[luaL_checkoption(L, 2, valid_types_as_luastring[0], valid_types_as_luastring)];
        let fengariProxy = createproxy(L, lua_toproxy(L, 1), type);
        push(L, fengariProxy);
        return 1;
    };
}
let jsmt = {
    "__index": function(L) {
        let u = checkjs(L, 1);
        let k = tojs(L, 2);
        push(L, u[k]);
        return 1;
    },
    "__newindex": function(L) {
        let u = checkjs(L, 1);
        let k = tojs(L, 2);
        let v = tojs(L, 3);
        if (v === void 0) Reflect_deleteProperty(u, k);
        else u[k] = v;
        return 0;
    },
    "__tostring": function(L) {
        let u = checkjs(L, 1);
        let s = toString(u);
        lua_pushstring(L, to_luastring(s));
        return 1;
    },
    "__call": function(L) {
        let u = checkjs(L, 1);
        let nargs = lua_gettop(L) - 1;
        let thisarg;
        let args = new Array(Math.max(0, nargs - 1));
        if (nargs > 0) {
            thisarg = tojs(L, 2);
            if (nargs-- > 0) {
                for(let i = 0; i < nargs; i++){
                    args[i] = tojs(L, i + 3);
                }
            }
        }
        push(L, apply(u, thisarg, args));
        return 1;
    },
    "__pairs": function(L) {
        let u = checkjs(L, 1);
        let f;
        let iter, state, first;
        if (typeof Symbol !== "function" || (f = u[Symbol.for("__pairs")]) === void 0) {
            /* By default, iterate over Object.keys */ iter = function(last) {
                if (this.index >= this.keys.length) return;
                let key = this.keys[this.index++];
                return [
                    key,
                    this.object[key]
                ];
            };
            state = {
                object: u,
                keys: Object.keys(u),
                index: 0
            };
        } else {
            let r = apply(f, u, []);
            if (r === void 0) luaL_error(L, to_luastring("bad '__pairs' result (object with keys 'iter', 'state', 'first' expected)"));
            iter = r.iter;
            if (iter === void 0) luaL_error(L, to_luastring("bad '__pairs' result (object.iter is missing)"));
            state = r.state;
            first = r.first;
        }
        lua_pushcfunction(L, function() {
            let state = tojs(L, 1);
            let last = tojs(L, 2);
            let r = apply(iter, state, [
                last
            ]);
            /* returning undefined indicates end of iteration */ if (r === void 0) return 0;
            /* otherwise it should return an array of results */ if (!Array.isArray(r)) luaL_error(L, to_luastring("bad iterator result (Array or undefined expected)"));
            luaL_checkstack(L, r.length, null);
            for(let i = 0; i < r.length; i++){
                push(L, r[i]);
            }
            return r.length;
        });
        push(L, state);
        push(L, first);
        return 3;
    },
    "__len": function(L) {
        let u = checkjs(L, 1);
        let f;
        let r;
        if (typeof Symbol !== "function" || (f = u[Symbol.for("__len")]) === void 0) {
            /* by default use .length field */ r = u.length;
        } else {
            r = apply(f, u, []);
        }
        push(L, r);
        return 1;
    }
};
const luaopen_js = function(L) {
    /* Add weak map to track objects seen */ states.set(getmainthread(L), new WeakMap());
    lua_atnativeerror(L, atnativeerror);
    luaL_newlib(L, jslib);
    lua_pushliteral(L, FENGARI_INTEROP_VERSION);
    lua_setfield(L, -2, to_luastring("_VERSION"));
    lua_pushinteger(L, FENGARI_INTEROP_VERSION_NUM);
    lua_setfield(L, -2, to_luastring("_VERSION_NUM"));
    lua_pushliteral(L, FENGARI_INTEROP_RELEASE);
    lua_setfield(L, -2, to_luastring("_RELEASE"));
    luaL_newmetatable(L, js_tname);
    luaL_setfuncs(L, jsmt, 0);
    lua_pop(L, 1);
    pushjs(L, null);
    /* Store null object in registry under lightuserdata null */ lua_pushvalue(L, -1);
    lua_rawsetp(L, LUA_REGISTRYINDEX, null);
    lua_setfield(L, -2, to_luastring("null"));
    push(L, global_env);
    lua_setfield(L, -2, to_luastring("global"));
    return 1;
};
module.exports.FENGARI_INTEROP_VERSION = FENGARI_INTEROP_VERSION;
module.exports.FENGARI_INTEROP_VERSION_NUM = FENGARI_INTEROP_VERSION_NUM;
module.exports.FENGARI_INTEROP_RELEASE = FENGARI_INTEROP_RELEASE;
module.exports.checkjs = checkjs;
module.exports.testjs = testjs;
module.exports.pushjs = pushjs;
module.exports.push = push;
module.exports.tojs = tojs;
module.exports.luaopen_js = luaopen_js;
}),
"[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("@prisma/client-2c3a283f134fdcb6", () => require("@prisma/client-2c3a283f134fdcb6"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__d429e4d0._.js.map