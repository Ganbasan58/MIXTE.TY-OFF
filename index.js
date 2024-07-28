const fs = require('fs');
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, Partials, REST, Routes, SlashCommandBuilder, ActivityType, PermissionsBitField, AttachmentBuilder } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const {
    Guilds,
    GuildMembers,
    GuildMessages,
    DirectMessages,
    MessageContent,
    GuildVoiceStates,
    GuildModeration,
    GuildMessageReactions
} = GatewayIntentBits;

const { User, Message, GuildMember, ThreadMember, Channel } = Partials;

const client = new Client({
    intents: [
        Guilds,
        GuildMembers,
        GuildMessages,
        DirectMessages,
        MessageContent,
        GuildVoiceStates,
        GuildModeration,
        GuildMessageReactions
    ],
    partials: [User, Message, GuildMember, ThreadMember, Channel]
});


client.once('ready', async () => {
    console.log('Le chasseur est prêt à ban !');
    client.user.setPresence({
        activities: [
            {
                name: 'Surveille MECS.TY',
                type: ActivityType.Custom
            }
        ],
        status: 'online'
    });
});

// Envoi de message de bienvenue et lien du serveur support
client.on('guildMemberAdd', async (member) => {
    const supportServerInvite = 'https://discord.gg/MSvAduZbRy'; // Lien d'invitation vers le serveur de support

    try {
        const welcomeMessage = `Bienvenue sur notre serveur ! Voici notre serveur support en cas de bannissement, vous pourrez demander un débannissement : ${supportServerInvite}`;
        await member.send(welcomeMessage);
        console.log(`Message envoyé à ${member.user.tag} lorsqu'il a rejoint le serveur.`);
    } catch (error) {
        console.error(`Erreur lors de l'envoi du message à ${member.user.tag}:`, error);
    }

    // Bannissement automatique de certains utilisateurs
    if (member.user.bot) return;
    if (member.id === "1227275121899737159" || member.id === "982664545111797861") {
        member.ban({ reason: `Compte non autorisé` }).then(() => {
            const channel = member.guild.channels.cache.get('1234937670128635989');
            if (channel) {
                channel.send(`BATCHA WAS HERE ! (Banni automatiquement)`);
            }
        }).catch(console.error);
    }
});

const minorRoleID = '1234937665762365563'; // ID du rôle mineur
const verificateursRoleID = '1234937665925943377'; // ID du rôle vérificateurs
const discussionsChannelID = '1241404218485637171'; // ID du salon discussions
const femmeRoleID = '1234937665879539735'; // ID du rôle Femme
const ticketCategoryID = '1234954130389340271'; // ID de la catégorie des tickets
const logsChannelID = '1262868686314934364'; // ID du salon logs ticket
const staffRoleID = '1234954130389340272'; // ID du rôle Staff

const banTimers = new Map(); // Pour stocker les minuteries de bannissement

// Fonction pour obtenir le message en fonction de l'heure
const getGreetingMessage = (user) => {
    const now = new Date();
    const hour = now.getHours();
    const userMention = `<@${user.id}>`;

    if (hour >= 6 && hour < 19) {
        return `Bonjour, quel est votre âge et date de naissance s'il vous plaît ? ${userMention}`;
    } else {
        return `Bonsoir, quel est votre âge et date de naissance s'il vous plaît ? ${userMention}`;
    }
};

// Fonction pour bannir un membre après un délai
const scheduleBan = async (member, roleName, alertMessage) => {
    try {
        const reason = `Bannissement automatique : Rôle ${roleName} non supprimé après 10 secondes`;
        await member.ban({ reason });
        console.log(`Le membre ${member.user.tag} a été banni pour avoir maintenu le rôle ${roleName}.`);
        // Mettre à jour le statut de l'alerte en "BANNI"
        if (alertMessage && alertMessage.embeds && alertMessage.embeds.length > 0) {
            const embed = alertMessage.embeds[0];
            const updatedEmbed = EmbedBuilder.from(embed)
                .setFields([{ name: 'Statut', value: '❌ | BANNI' }]);
            await alertMessage.edit({ embeds: [updatedEmbed] });
            await alertMessage.reply(`L'alerte est mise à jour : ${member.user.tag} a été banni.`);
            await alertMessage.reactions.removeAll(); // Efface toutes les réactions du message
        } else {
            console.error('alertMessage ou alertMessage.embeds est indéfini');
        }
    } catch (error) {
        console.error(`Erreur lors du bannissement du membre ${member.user.tag}:`, error);
    }
};

// Gestion des mises à jour de rôles des membres
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const minorRole = newMember.guild.roles.cache.get(minorRoleID);
    const verificateursRole = newMember.guild.roles.cache.get(verificateursRoleID);
    const discussionsChannel = newMember.guild.channels.cache.get(discussionsChannelID);
    const femmeRole = newMember.guild.roles.cache.get(femmeRoleID);
    const logsChannel = newMember.guild.channels.cache.get(logsChannelID);
    const staffRole = newMember.guild.roles.cache.get(staffRoleID);

    if (minorRole && verificateursRole && discussionsChannel && femmeRole && logsChannel) {
        const oldHasMinorRole = oldMember.roles.cache.has(minorRoleID);
        const newHasMinorRole = newMember.roles.cache.has(minorRoleID);
        const oldHasFemmeRole = oldMember.roles.cache.has(femmeRoleID);
        const newHasFemmeRole = newMember.roles.cache.has(femmeRoleID);

        const sendAlert = async (roleName, roleID, alertTitle) => {
            if (newMember.roles.cache.has(verificateursRoleID)) {
                console.log(`Le membre ${newMember.user.tag} a pris le rôle ${roleName} cependant il possède le rôle vérificateurs donc => aucun bannissement nécessaire.`);
                return;
            }

            if (newMember.roles.cache.has(staffRoleID)) {
                console.log(`Le membre ${newMember.user.tag} a pris le rôle ${roleName} mais possède aussi le rôle Staff donc => aucun bannissement nécessaire.`);
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0xFFFF00) // Couleur jaune
                .setTitle(alertTitle)
                .setDescription(`${newMember.user} a pris le rôle ${roleName} !`);

            // Ajouter ou ne pas ajouter le champ de statut et les réactions en fonction du rôle
            if (roleID === minorRoleID || roleID === femmeRoleID) {
                // Pour les rôles mineur et femme, ne pas ajouter le champ de statut et les réactions
                embed.addFields(
                    { name: 'Réactions', value: '🟠 : En cours de traitement\n✅ : Définir comme traitée\n👼 : Ouvrir un ticket' }
                );
            } else {
                // Pour les autres rôles, ajouter le champ de statut et les réactions
                embed.addFields(
                    { name: 'Statut', value: '❌ | Non traitée' },
                    { name: 'Réactions', value: '❌ : Marquer comme RAS\n🟠 : En cours de traitement\n✅ : Définir comme traitée\n👼 : Ouvrir un ticket' }
                );
            }

            embed.setTimestamp();

            const alertMessage = await discussionsChannel.send({ content: `<@&${verificateursRoleID}>`, embeds: [embed] });

            if (roleID !== minorRoleID && roleID !== femmeRoleID) {
                // Ajouter la réaction ❌ uniquement pour les rôles autres que mineur et femme
                await alertMessage.react('❌');
            }
            await alertMessage.react('🟠');
            await alertMessage.react('✅');
            await alertMessage.react('👼');

            const filter = (reaction, user) => {
                return ['❌', '🟠', '✅', '👼'].includes(reaction.emoji.name) && !user.bot;
            };

            const collector = alertMessage.createReactionCollector({ filter, time: 259200000 }); // 72 heures en millisecondes

            let ticketInProgress = false; // Variable pour suivre si un ticket est en cours
            let ticketChannel; // Variable pour garder la référence du salon privé
            let ticketCreator; // Variable pour garder la référence du membre du staff qui a ouvert le salon privé

            collector.on('collect', async (reaction, user) => {
                // Vérifier si l'utilisateur qui réagit a le rôle vérificateurs
                const member = await newMember.guild.members.fetch(user.id); // Assurez-vous que vous avez l'objet Member complet
                if (!member || !member.roles.cache.has(verificateursRoleID)) {
                    await alertMessage.reply(`Seules les personnes ayant le rôle vérificateurs peuvent réagir à ce message.`);
                    return;
                }

                const userName = user.username;

                if (reaction.emoji.name === '✅') {
                    const updatedEmbed = EmbedBuilder.from(embed)
                        .setFields([{ name: 'Statut', value: `✅ | Traité par ${userName}` }]);
                    await alertMessage.edit({ embeds: [updatedEmbed] });
                    await alertMessage.reply(`L'alerte est traitée par ${userName}`);
                    await alertMessage.reactions.removeAll(); // Efface toutes les réactions du message
                    ticketInProgress = false; // Réinitialiser le statut du ticket
                    collector.stop(); // Arrêter le collecteur après le traitement

                    if (ticketChannel) {
                        // Collecter les messages du salon privé avant de le supprimer
                        const messages = await ticketChannel.messages.fetch({ limit: 100 });
                        const messageLog = messages.map(m => `${m.author.tag}: ${m.content}`).reverse().join('\n');

                        // Créer un fichier texte avec la transcription
                        const filePath = `./transcription-${newMember.user.id}.txt`;
                        fs.writeFileSync(filePath, messageLog);

                        // Envoyer la transcription dans le salon de logs
                        if (logsChannel) {
                            const attachment = new AttachmentBuilder(filePath);
                            logsChannel.send({ content: `Transcription du ticket de ${newMember.user.tag}:`, files: [attachment] })
                                .then(() => {
                                    fs.unlinkSync(filePath); // Supprimer le fichier local après envoi
                                })
                                .catch(console.error);
                        }

                        // Supprimer le salon privé
                        await ticketChannel.delete();
                        console.log(`Le salon ${ticketChannel.name} a été supprimé.`);
                    }
                } else if (reaction.emoji.name === '❌') {
                    const updatedEmbed = EmbedBuilder.from(embed)
                        .setFields([{ name: 'Statut', value: `❌ | RAS` }]);
                    await alertMessage.edit({ embeds: [updatedEmbed] });
                    await alertMessage.reply(`L'alerte est traitée comme RAS par ${userName}`);
                    await alertMessage.reactions.removeAll(); // Efface toutes les réactions du message
                    ticketInProgress = false; // Réinitialiser le statut du ticket
                    collector.stop(); // Arrêter le collecteur après le traitement

                    if (ticketChannel) {
                        // Collecter les messages du salon privé avant de le supprimer
                        const messages = await ticketChannel.messages.fetch({ limit: 100 });
                        const messageLog = messages.map(m => `${m.author.tag}: ${m.content}`).reverse().join('\n');

                        // Créer un fichier texte avec la transcription
                        const filePath = `./transcription-${newMember.user.id}.txt`;
                        fs.writeFileSync(filePath, messageLog);

                        // Envoyer la transcription dans le salon de logs
                        if (logsChannel) {
                            const attachment = new AttachmentBuilder(filePath);
                            logsChannel.send({ content: `Transcription du ticket de ${newMember.user.tag}:`, files: [attachment] })
                                .then(() => {
                                    fs.unlinkSync(filePath); // Supprimer le fichier local après envoi
                                })
                                .catch(console.error);
                        }

                        // Supprimer le salon privé
                        await ticketChannel.delete();
                        console.log(`Le salon ${ticketChannel.name} a été supprimé.`);
                    }
                } else if (reaction.emoji.name === '🟠') {
                    const updatedEmbed = EmbedBuilder.from(embed)
                        .setFields([{ name: 'Statut', value: `🟠 | En cours de traitement par ${userName}` }]);
                    await alertMessage.edit({ embeds: [updatedEmbed] });
                    await alertMessage.reply(`L'alerte est en cours de traitement par ${userName}`);
                } else if (reaction.emoji.name === '👼') {
                    if (ticketInProgress) {
                        await alertMessage.reply(`Un ticket est déjà en cours pour cette alerte.`);
                        return;
                    }

                    // Création d'un salon privé pour les discussions
                    ticketChannel = await newMember.guild.channels.create({
                        name: `ticket-${newMember.user.username}`,
                        type: 0, // Salon textuel
                        parent: ticketCategoryID, // Définir la catégorie parente
                        permissionOverwrites: [
                            {
                                id: newMember.guild.id,
                                deny: [PermissionsBitField.Flags.ViewChannel], // Refuser l'accès à tous les membres
                            },
                            {
                                id: verificateursRoleID,
                                allow: [PermissionsBitField.Flags.ViewChannel], // Permettre l'accès aux vérificateurs
                            },
                            {
                                id: newMember.user.id, // Permettre l'accès à l'utilisateur concerné par l'alerte
                                allow: [PermissionsBitField.Flags.ViewChannel],
                            },
                            {
                                id: user.id, // Permettre l'accès à l'utilisateur qui a ouvert le ticket
                                allow: [PermissionsBitField.Flags.ViewChannel],
                            },
                        ],
                    });

                    ticketInProgress = true;
                    ticketCreator = user; // Assigner le créateur du ticket

                    // Envoyer un message dans le nouveau salon
                    const ticketEmbed = new EmbedBuilder()
                        .setColor(0x00FFFF) // Couleur cyan
                        .setTitle('Ticket de vérification')
                        .setDescription(`Ce salon a été ouvert pour discuter du rôle ${roleName} de ${newMember.user}. \n\n**Créé par :** ${user.username}`) // Ajouter le créateur du ticket
                        .setTimestamp();

                    await ticketChannel.send({ embeds: [ticketEmbed] });

                    // Envoyer le message en fonction de l'heure
                    const greetingMessage = getGreetingMessage(newMember.user);
                    await ticketChannel.send(greetingMessage);

                    await alertMessage.reply(`Un salon privé a été créé pour discuter de l'alerte.`);
                    // Effacer les réactions de l'utilisateur après l'interaction
                    await reaction.users.remove(user.id);
                }
            });

            collector.on('end', collected => {
                console.log(`Le collecteur de réactions pour l'alerte ${alertMessage.id} a pris fin.`);
            });

            return alertMessage;
        };

        if (!oldHasMinorRole && newHasMinorRole) {
            const alertMessage = await sendAlert('mineur', minorRoleID, '⚠️ ALERTE MINEUR ⚠️');
            // Planifier le bannissement si le rôle mineur est maintenu après 10 secondes
            const banTimeout = setTimeout(async () => {
                if (newMember.roles.cache.has(minorRoleID) && !newMember.roles.cache.has(staffRoleID)) {
                    await scheduleBan(newMember, 'mineur', alertMessage);
                }
            }, 10000);
            banTimers.set(newMember.id, banTimeout);
        } else if (oldHasMinorRole && !newHasMinorRole) {
            // Annuler le bannissement si le rôle mineur est retiré
            const banTimeout = banTimers.get(newMember.id);
            if (banTimeout) {
                clearTimeout(banTimeout);
                banTimers.delete(newMember.id);
                console.log(`Le bannissement du membre ${newMember.user.tag} a été annulé car le rôle mineur a été retiré.`);
            }
        }

        if (!oldHasFemmeRole && newHasFemmeRole) {
            const alertMessage = await sendAlert('Femme', femmeRoleID, '⚠️ ALERTE FEMME ⚠️');
            // Planifier le bannissement si le rôle Femme est maintenu après 10 secondes
            const banTimeout = setTimeout(async () => {
                if (newMember.roles.cache.has(femmeRoleID) && !newMember.roles.cache.has(staffRoleID)) {
                    await scheduleBan(newMember, 'Femme', alertMessage);
                }
            }, 10000);
            banTimers.set(newMember.id, banTimeout);
        } else if (oldHasFemmeRole && !newHasFemmeRole) {
            // Annuler le bannissement si le rôle Femme est retiré
            const banTimeout = banTimers.get(newMember.id);
            if (banTimeout) {
                clearTimeout(banTimeout);
                banTimers.delete(newMember.id);
                console.log(`Le bannissement du membre ${newMember.user.tag} a été annulé car le rôle Femme a été retiré.`);
            }
        }
    }
});

// LISTBANS Command
client.on('messageCreate', async message => {
    if (message.content === '!listbans') {
        if (!message.member.permissions.has('BAN_MEMBERS')) {
            return message.reply('Vous n\'avez pas la permission d\'utiliser cette commande.');
        }
        try {
            const bans = await message.guild.bans.fetch();
            if (bans.size === 0) {
                return message.reply('Il n\'y a aucun utilisateur banni sur ce serveur.');
            }
            let minorBanCount = 0;
            let femmeBanCount = 0;
            bans.forEach(ban => {
                const reason = ban.reason ? ban.reason.toLowerCase() : '';
                if (reason.includes('mineur') || reason.includes('rôle mineur')) {
                    minorBanCount++;
                }
                if (reason.includes('femme') || reason.includes('rôle femme')) {
                    femmeBanCount++;
                }
            });
            const totalBanCount = minorBanCount + femmeBanCount;
            const embed = new EmbedBuilder()
                .setTitle('Liste des utilisateurs bannis')
                .setColor('#FF0000')
                .addFields(
                    { name: 'Nombre de bannissements pour "mineur"', value: `:arrow_right: ${minorBanCount}`, inline: false },
                    { name: 'Nombre de bannissements pour "femme"', value: `:arrow_right: ${femmeBanCount}`, inline: false },
                    { name: 'Nombre total de bannissements', value: `:arrow_right: ${totalBanCount}`, inline: false }
                )
                .setFooter({ text: 'Commande !listbans' });
            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            message.reply('Une erreur est survenue lors de la récupération de la liste des utilisateurs bannis.');
        }
    }
});

// Vérification si le bot est on
client.on('messageCreate', message => {
    if (message.content === 'ping') {
        message.channel.send('pong');
    }
});

// Alerte réaction
const ALERT_CHANNEL_ID = '1241404218485637171';
const VERIFICATEUR_ROLE_ID = '1234937665925943377'; // Remplacez par l'ID réel du rôle vérificateur

client.on('messageReactionAdd', async (reaction, user) => {
    // Ne pas traiter les réactions des bots
    if (user.bot) return;

    if (reaction.emoji.name === '⚠️') {
        console.log('Réaction avec ⚠️ détectée !');

        // Vérifiez si les objets sont définis
        const alertChannel = client.channels.cache.get(ALERT_CHANNEL_ID);
        if (!alertChannel) {
            console.error('Le salon d\'alerte est introuvable.');
            return;
        }

        try {
            // Assurez-vous que le message est complètement récupéré
            const message = await reaction.message.fetch();
            const messageAuthor = message.author;
            const verificateurRole = message.guild.roles.cache.get(VERIFICATEUR_ROLE_ID);

            // Vérifiez si les objets sont définis
            if (!messageAuthor) {
                console.error('Auteur du message introuvable.');
                return;
            }

            if (!verificateurRole) {
                console.error('Le rôle vérificateur est introuvable.');
                return;
            }

            // Convertir la couleur hex en entier
            const color = parseInt('FFFF00', 16);

            const embed = new EmbedBuilder()
                .setTitle('Alerte')
                .setColor(color)
                .addFields(
                    { name: 'Alerte par', value: user.tag, inline: true },
                    { name: 'Auteur du message', value: messageAuthor.tag, inline: true },
                    { name: 'Salon', value: message.channel.toString(), inline: true },
                    { name: 'Message', value: message.content },
                    { name: 'Statut', value: '❌ | Non traité', inline: true }
                )
                .setTimestamp();

            const alertMessage = await alertChannel.send({ content: verificateurRole ? `**Mention Vérificateurs :** ${verificateurRole}` : '', embeds: [embed] });

            await alertMessage.react('❌');
            await alertMessage.react('🟠');
            await alertMessage.react('✅');

            const filter = (reaction, user) => ['❌', '🟠', '✅'].includes(reaction.emoji.name) && !user.bot;
            const collector = alertMessage.createReactionCollector({ filter, time: 86400000 }); // 24 heures

            collector.on('collect', async (reaction, user) => {
                if (!user) return;

                const userName = user.username;

                // Vérifiez si l'utilisateur a le rôle vérificateur
                const member = await message.guild.members.fetch(user.id);
                const hasVerificateurRole = member.roles.cache.has(VERIFICATEUR_ROLE_ID);

                if (!hasVerificateurRole) {
                    await alertMessage.reply(`${userName}, vous devez avoir le rôle vérificateur pour gérer cette alerte.`);
                    return;
                }

                if (reaction.emoji.name === '✅') {
                    embed.fields.find(field => field.name === 'Statut').value = `✅ | Traité par ${userName}`;
                    await alertMessage.edit({ embeds: [embed] });
                    await alertMessage.reply(`L'alerte a été traitée par ${userName}`);
                    await alertMessage.reactions.removeAll(); // Efface toutes les réactions du message
                    collector.stop(); // Arrêter le collecteur après le traitement
                } else if (reaction.emoji.name === '❌') {
                    embed.fields.find(field => field.name === 'Statut').value = `✅ | RAS`;
                    await alertMessage.edit({ embeds: [embed] });
                    await alertMessage.reply(`L'alerte est marquée RAS par ${userName}`);
                    await alertMessage.reactions.removeAll(); // Efface toutes les réactions du message
                    collector.stop(); // Arrêter le collecteur après le traitement
                } else if (reaction.emoji.name === '🟠') {
                    embed.fields.find(field => field.name === 'Statut').value = `🟠 | En cours de traitement par ${userName}`;
                    await alertMessage.edit({ embeds: [embed] });
                    await alertMessage.reply(`L'alerte est en cours de traitement par ${userName}`);
                }
            });

            collector.on('end', async collected => {
                if (!collected.some(r => r.emoji.name === '✅' || r.emoji.name === '❌')) {
                    embed.fields.find(field => field.name === 'Statut').value = '❌ | Non traité';
                    await alertMessage.edit({ embeds: [embed] });
                    await alertMessage.reply('La période de traitement de cette alerte est terminée.');
                }
            });
        } catch (error) {
            console.error('Erreur lors de la gestion de la réaction:', error);
        }
    }
});


const CHANNEL_ID = '1248717888895057950';
client.on('messageCreate', message => {
    if (message.channel.id === CHANNEL_ID && !message.author.bot) {
        const response = '# ✅ | Règles\n\n >>> Vous pouvez envoyer des blagues et tout ce qui touche à **l\'humour.** \n:arrow_right: A noter que **l\'humour noir** doit être masqué de cette façon || Humour noir ||';
        message.channel.send(response);
    }
});

const confessionChannelId = '1250834477878480977';
const logChannelId = '1243642249238155295';

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Vérifiez si le message n'est pas envoyé dans un serveur (message privé)
    if (!message.guild) {
        const confession = message.content;
        const confessionChannel = await client.channels.fetch(confessionChannelId);
        const logChannel = await client.channels.fetch(logChannelId);

        if (confessionChannel && logChannel) {
            try {
                const confessionEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Confession Anonyme')
                    .setDescription(confession)
                    .setTimestamp();

                const sentConfessionMessage = await confessionChannel.send({ embeds: [confessionEmbed] });
                await sentConfessionMessage.react('✅');

                const followUpMessage = '## ▶️ Pour confesser, veuillez envoyer votre confession à <@1238536258544734248>';
                await confessionChannel.send(followUpMessage);

                const logEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('Nouvelle Confession')
                    .setDescription(confession)
                    .addFields({ name: 'Auteur', value: `${message.author.tag} (ID: ${message.author.id})` })
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
                await message.author.send('Votre confession a bien été publiée anonymement !');
            } catch (error) {
                console.error('Erreur lors de l\'envoi de la confession:', error);
                await message.author.send("Une erreur s'est produite lors du traitement de votre confession. Veuillez réessayer plus tard.");
            }
        } else {
            await message.author.send("Une erreur s'est produite lors du traitement de votre confession. Veuillez réessayer plus tard.");
        }
        return;
    }

    if (message.channel.id === ALERT_CHANNEL_ID) return;

    const staffRoleId = '1234937665925943378';
    const staffRole = message.guild.roles.cache.get(staffRoleId);

    // Vérifiez si l'auteur du message a le rôle staff
    if (message.member.roles.cache.has(staffRoleId)) return;

    
    const numbers = message.content.match(/\b\d+\b/g);
    if (numbers) {
        const containsNumberBetween1And17 = numbers.some(num => parseInt(num) >= 1 && parseInt(num) <= 17);
        if (containsNumberBetween1And17) {
            const alertChannel = message.guild.channels.cache.get(ALERT_CHANNEL_ID);
            const verificateurRole = message.guild.roles.cache.get(VERIFICATEUR_ROLE_ID);

            if (alertChannel && verificateurRole) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFFF00) // Couleur jaune
                    .setTitle('Alerte : Nombre entre 1 et 17 détecté')
                    .setDescription(`${message.author} a envoyé un message contenant un nombre entre 1 et 17 dans le salon ${message.channel}.`)
                    .addFields(
                        { name: 'Message', value: message.content },
                        { name: 'Statut', value: '❌ | Non traitée' }
                    )
                    .setTimestamp();

                const alertMessage = await alertChannel.send({ content: `${verificateurRole}`, embeds: [embed] });

                await alertMessage.react('🟠'); // Réaction pour "En cours de traitement"
                await alertMessage.react('✅'); // Réaction pour "Traitée"
                await alertMessage.react('❌'); // Réaction pour "RAS"

                const filter = (reaction, user) => {
                    return ['🟠', '✅', '❌'].includes(reaction.emoji.name) && !user.bot;
                };

                const collector = alertMessage.createReactionCollector({ filter, time: 259200000 }); // 72 heures en millisecondes

                collector.on('collect', async (reaction, user) => {
                    if (!user) return;

                    const userName = user.username;

                    // Vérifiez si l'utilisateur a le rôle vérificateur
                    const member = await message.guild.members.fetch(user.id);
                    const hasVerificateurRole = member.roles.cache.has(VERIFICATEUR_ROLE_ID);

                    if (!hasVerificateurRole) {
                        await alertMessage.reply(`${userName}, vous devez avoir le rôle vérificateur pour gérer cette alerte.`);
                        return;
                    }

                    const statusField = embed.data.fields.find(field => field.name === 'Statut');
                    if (!statusField) {
                        console.error('Le champ "Statut" est introuvable dans l\'embed.');
                        return;
                    }

                    if (reaction.emoji.name === '✅') {
                        statusField.value = `✅ | Traité par ${userName}`;
                        await alertMessage.edit({ embeds: [embed] });
                        await alertMessage.reply(`L'alerte est traitée par ${userName}`);
                        await alertMessage.reactions.removeAll(); // Efface toutes les réactions du message
                        collector.stop(); // Arrêter le collecteur après le traitement
                    } else if (reaction.emoji.name === '❌') {
                        statusField.value = `✅ | RAS`;
                        await alertMessage.edit({ embeds: [embed] });
                        await alertMessage.reply(`L'alerte est marquée RAS par ${userName}`);
                        await alertMessage.reactions.removeAll(); // Efface toutes les réactions du message
                        collector.stop(); // Arrêter le collecteur après le traitement
                    } else if (reaction.emoji.name === '🟠') {
                        statusField.value = `🟠 | En cours de traitement par ${userName}`;
                        await alertMessage.edit({ embeds: [embed] });
                        await alertMessage.reply(`L'alerte est en cours de traitement par ${userName}`);
                    }
                });

                collector.on('end', async collected => {
                    const statusField = embed.data.fields.find(field => field.name === 'Statut');
                    if (!collected.some(reaction => reaction.emoji.name === '✅' || reaction.emoji.name === '❌')) {
                        if (statusField) {
                            statusField.value = '❌ | Non traitée';
                            await alertMessage.edit({ embeds: [embed] });
                            await alertMessage.reply('La période de traitement de cette alerte est terminée.');
                            await alertMessage.reactions.removeAll(); // Efface toutes les réactions du message après la fin de la collecte
                        } else {
                            console.error('Le champ "Statut" est introuvable dans l\'embed.');
                        }
                    }
                });
            } else {
                console.error('Le canal d\'alerte ou le rôle vérificateur est introuvable.');
            }
        }
    }
});



client.on('messageCreate', async (message) => {
    if (message.author.bot) return; // Ignore les messages des autres bots

    if (message.content.toLowerCase().startsWith('!clear')) {
        if (!message.member.permissions.has('MANAGE_MESSAGES')) {
            return message.reply('Vous n\'avez pas la permission de supprimer des messages !');
        }

        const args = message.content.split(' ').slice(1); // Sépare la commande et les arguments
        const amount = parseInt(args[0]);

        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply('Veuillez spécifier un nombre entre 1 et 100 pour supprimer.');
        }

        try {
            const fetched = await message.channel.messages.fetch({ limit: amount });
            
            // Filtrer les messages qui ont moins de 14 jours
            const filteredMessages = fetched.filter(msg => Date.now() - msg.createdTimestamp < 1209600000); // 1209600000 ms = 14 jours

            if (filteredMessages.size === 0) {
                return message.reply('Aucun message à supprimer car ils sont tous âgés de plus de 14 jours.');
            }

            await message.channel.bulkDelete(filteredMessages, true);
            message.channel.send(`Suppression de ${filteredMessages.size} messages réussie.`).then(msg => msg.delete({ timeout: 5000 }));
        } catch (err) {
            console.error('Erreur lors de la suppression des messages :', err);
            message.channel.send('Une erreur est survenue lors de la suppression des messages.');
        }
    }
});


const WAITING_ROOM_ID = '1256901861449928714'; // ID du salon "attente moove"
const DISCUSSIONS_CHANNEL_ID = '1241404218485637171'; // ID du salon discussions
const STAFF_ROLE_ID = '1234937665925943378';
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.channelId === WAITING_ROOM_ID && oldState.channelId !== WAITING_ROOM_ID) {
        const member = newState.member;
        const discussionsChannel = newState.guild.channels.cache.get(DISCUSSIONS_CHANNEL_ID);
        const staffRole = newState.guild.roles.cache.get(STAFF_ROLE_ID);
        if (discussionsChannel && staffRole) {
            const embed = new EmbedBuilder()
                .setColor(0xFFFF00) // Couleur jaune
                .setTitle('Attente moove')
                .setDescription(`${member.user} est en attente de moove !`)
                .addFields({ name: 'Statut', value: '❌ | Non traitée' })
                .setTimestamp();
            const alertMessage = await discussionsChannel.send({ content: `${staffRole}`, embeds: [embed] });
            await alertMessage.react('🟠');
            await alertMessage.react('✅');
            const filter = (reaction, user) => {
                return ['🟠', '✅'].includes(reaction.emoji.name) && !user.bot;
            };
            const collector = alertMessage.createReactionCollector({ filter, time: 259200000 }); // 72 heures en millisecondes
            collector.on('collect', async (reaction, user) => {
                const userName = user.username;
                if (reaction.emoji.name === '✅') {
                    embed.spliceFields(0, 1, { name: 'Statut', value: `✅ | Traitée par ${userName}` });
                    await alertMessage.edit({ embeds: [embed] });
                    await alertMessage.reply(`L'alerte est traitée par ${userName}`);
                    await alertMessage.reactions.removeAll(); // Efface toutes les réactions du message
                    collector.stop(); // Arrêter le collecteur après le traitement
                } else if (reaction.emoji.name === '🟠') {
                    embed.spliceFields(0, 1, { name: 'Statut', value: `🟠 | En cours de traitement par ${userName}` });
                    await alertMessage.edit({ embeds: [embed] });
                    await alertMessage.reply(`L'alerte est en cours de traitement par ${userName}`);
                }
            });
            collector.on('end', async collected => {
                if (!collected.some(reaction => reaction.emoji.name === '✅')) {
                    embed.spliceFields(0, 1, { name: 'Statut', value: '❌ | Non traitée' });
                    await alertMessage.edit({ embeds: [embed] });
                    await alertMessage.reply('La période de traitement de cette alerte est terminée.');
                }
            });
        } else {
            console.error('Le salon de discussions ou le rôle staff est introuvable.');
        }
    }
});



client.on('messageCreate', message => {
    if (message.content === '!roles') {
        // Récupérer et trier les rôles par position
        const roles = message.guild.roles.cache
            .sort((a, b) => b.position - a.position)
            .map(role => `Nom: ${role.name}, ID: ${role.id}`)
            .join('\n');

        if (roles.length <= 2000) {
            // Si la longueur du message est acceptable, envoyez le message directement
            message.channel.send(`Voici la liste des rôles du serveur dans l'ordre:\n${roles}`);
        } else {
            // Sinon, divisez le message en morceaux
            const chunkSize = 2000;
            for (let i = 0; i < roles.length; i += chunkSize) {
                const chunk = roles.substring(i, i + chunkSize);
                message.channel.send(chunk);
            }
        }
    }
});


let votes = {};
let voteEmbedMessage = null;

// Commandes slash
const commands = [
    new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Lance un vote')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Le message à afficher pour le vote')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('option1')
                .setDescription('Première option de vote')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('option2')
                .setDescription('Deuxième option de vote')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('option3')
                .setDescription('Troisième option de vote')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('option4')
                .setDescription('Quatrième option de vote')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('option5')
                .setDescription('Cinquième option de vote')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('option6')
                .setDescription('Sixième option de vote')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('option7')
                .setDescription('Septième option de vote')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('option8')
                .setDescription('Huitième option de vote')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('option9')
                .setDescription('Neuvième option de vote')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('option10')
                .setDescription('Dixième option de vote')
                .setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('reponse')
        .setDescription('Voter anonymement')
        .addStringOption(option =>
            option.setName('option')
                .setDescription('Numéro de l\'option pour laquelle vous votez')
                .setRequired(true)
        )
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

client.on('ready', () => {
    console.log('Bot is ready!');
    client.user.setActivity('voter', { type: ActivityType.Listening });
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'vote') {
        const voteMessage = interaction.options.getString('message');
        const options = [];

        for (let i = 1; i <= 10; i++) {
            const option = interaction.options.getString(`option${i}`);
            if (option) {
                options.push({ name: `${i}️⃣`, value: option, inline: true });
            }
        }

        votes = {};  // Réinitialiser les votes pour un nouveau vote

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Vote')
            .setDescription(voteMessage)
            .addFields(options)
            .setTimestamp();

        const voteMessageReply = await interaction.reply({ embeds: [embed], fetchReply: true });
        voteEmbedMessage = voteMessageReply;
    } else if (commandName === 'reponse') {
        const option = interaction.options.getString('option');
        if (!['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].includes(option)) {
            return interaction.reply({ content: 'Option invalide. Veuillez choisir un numéro entre 1 et 10.', ephemeral: true });
        }

        const userId = interaction.user.id;
        if (!votes[userId]) {
            votes[userId] = option;

            // Mise à jour de l'embed avec les résultats des votes
            const voteCounts = {};
            for (let i = 1; i <= 10; i++) {
                voteCounts[i] = 0;
            }
            Object.values(votes).forEach(vote => {
                voteCounts[vote]++;
            });

            const updatedFields = voteEmbedMessage.embeds[0].fields.map(field => {
                const optionNumber = field.name[0];
                return {
                    name: field.name,
                    value: `${field.value} - ${voteCounts[optionNumber] || 0} vote${voteCounts[optionNumber] === 1 ? '' : 's'}`,
                    inline: true
                };
            });

            const updatedEmbed = EmbedBuilder.from(voteEmbedMessage.embeds[0])
                .setFields(updatedFields);

            voteEmbedMessage.edit({ embeds: [updatedEmbed] });
            interaction.reply({ content: 'Votre vote a été enregistré.', ephemeral: true });
        } else {
            interaction.reply({ content: 'Vous avez déjà voté.', ephemeral: true });
        }
    }
});

client.on('messageCreate', message => {
    if (message.content === '!stopvote' && message.guild) {
        const voteCounts = {};
        for (let i = 1; i <= 10; i++) {
            voteCounts[i] = 0;
        }
        Object.values(votes).forEach(vote => {
            voteCounts[vote]++;
        });

        let results = 'Résultats des votes :\n';
        for (const [option, count] of Object.entries(voteCounts)) {
            if (count > 0) {
                results += `Option ${option} : ${count} vote${count === 1 ? '' : 's'}\n`;
            }
        }

        message.channel.send(results);
    }
});

client.login(process.env.TOKEN);
