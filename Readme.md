## Indiware crawler

This crawler gets contents from stundenplan24.de for the vertretungsplan.io application.
It parses the XML files which are used in the online viewer.

All data is served directly from this application,
the client does not connect to stundenplan24.

Schools are managed in the source code at ``src/config/data.ts``.
Access data is passend in using environment variables
to allow making this public without disclosing the access data.

If only some access data is provided, then only the schools
with access data are crawled and served.

The listening port can be set using the ``PORT`` environment variable.
By default, it's 8080.

### License

AGPL 3.0

> vertretungsplan.io indiware crawler
> Copyright (C) 2019 - 2022 Jonas Lochmann
>
> This program is free software: you can redistribute it and/or modify
> it under the terms of the GNU Affero General Public License as
> published by the Free Software Foundation, version 3 of the
> License.
>
> This program is distributed in the hope that it will be useful,
> but WITHOUT ANY WARRANTY; without even the implied warranty of
> MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
> GNU Affero General Public License for more details.
>
> You should have received a copy of the GNU Affero General Public License
> along with this program.  If not, see <https://www.gnu.org/licenses/>.
