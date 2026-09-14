/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
    ApiConfiguration,
    CdnConfiguration,
    ComponentConfiguration,
    DefaultsConfiguration,
    EmailConfiguration,
    EmbedConfiguration,
    EndpointConfiguration,
    GeneralConfiguration,
    GifConfiguration,
    GiphyGifConfiguration,
    GuildConfiguration,
    KlipyGifConfiguration,
    LimitsConfiguration,
    LoginConfiguration,
    PasswordResetConfiguration,
    RabbitMQConfiguration,
    RegionConfiguration,
    RegisterConfiguration,
    SecurityConfiguration,
    TemplateConfiguration,
    UserConfiguration,
    WebRTCConfiguration,
    ProxyConfiguration,
} from "./types/index.js";

export class ConfigValue {
    gateway: EndpointConfiguration = new EndpointConfiguration();
    cdn: CdnConfiguration = new CdnConfiguration();
    api: ApiConfiguration = new ApiConfiguration();
    general: GeneralConfiguration = new GeneralConfiguration();
    limits: LimitsConfiguration = new LimitsConfiguration();
    security: SecurityConfiguration = new SecurityConfiguration();
    login: LoginConfiguration = new LoginConfiguration();
    register: RegisterConfiguration = new RegisterConfiguration();
    regions: RegionConfiguration = new RegionConfiguration();
    guild: GuildConfiguration = new GuildConfiguration();
    gif: GifConfiguration = new GifConfiguration();
    klipygif: KlipyGifConfiguration = new KlipyGifConfiguration();
    giphygif: GiphyGifConfiguration = new GiphyGifConfiguration();
    rabbitmq: RabbitMQConfiguration = new RabbitMQConfiguration();
    templates: TemplateConfiguration = new TemplateConfiguration();
    defaults: DefaultsConfiguration = new DefaultsConfiguration();
    email: EmailConfiguration = new EmailConfiguration();
    passwordReset: PasswordResetConfiguration = new PasswordResetConfiguration();
    user: UserConfiguration = new UserConfiguration();
    components = new ComponentConfiguration();
    embeds = new EmbedConfiguration();
    webrtc = new WebRTCConfiguration();
    proxy = new ProxyConfiguration();
}
